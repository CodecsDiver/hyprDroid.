import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import type { EventInbox } from './inbox'

export type ConnectionStatus = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'offline'

/** Tables whose changes should make feature views refresh. */
export const WATCHED_TABLES = [
  'moods', 'garden_plants', 'hidden_notes', 'household_state', 'listening_sessions', 'listening_consent', 'date_ideas',
  'love_notes', 'stickers', 'spell_recipes', 'memories', 'tracks', 'playlists',
] as const
export type WatchedTable = (typeof WATCHED_TABLES)[number]

export interface HubOptions {
  client: SupabaseClient
  userId: string
  householdId: string
  inbox: EventInbox
  onStatus: (status: ConnectionStatus) => void
  onTableChange: (table: WatchedTable) => void
  onPartnerPresence: (here: boolean) => void
  onPartnerHeart: () => void
}

/**
 * Owns the realtime connection.
 *
 * - `events` rows addressed to me arrive by postgres_changes (RLS-filtered).
 * - Every (re)subscription triggers a catch-up fetch, so nothing sent while
 *   this device was offline, asleep or between reconnects is missed.
 * - Presence + broadcast on a private `household:<id>` channel carry the
 *   ephemeral signals (partner is here, partner is pressing the heart).
 *   They are NOT durable; durable things go through the events table.
 */
export class RealtimeHub {
  private dataChannel: RealtimeChannel | null = null
  private presenceChannel: RealtimeChannel | null = null
  private retry: ReturnType<typeof setTimeout> | null = null
  private watchdog: ReturnType<typeof setInterval> | null = null
  private attempt = 0
  private stopped = true
  private status: ConnectionStatus = 'idle'
  private lastLiveAt = 0

  constructor(private readonly o: HubOptions) {}

  start(): void {
    if (!this.stopped) return
    this.stopped = false
    addEventListener('online', this.onOnline)
    addEventListener('offline', this.onOffline)
    document.addEventListener('visibilitychange', this.onVisibility)
    this.watchdog = setInterval(() => this.check(), 15_000)
    this.connect()
  }

  stop(): void {
    this.stopped = true
    removeEventListener('online', this.onOnline)
    removeEventListener('offline', this.onOffline)
    document.removeEventListener('visibilitychange', this.onVisibility)
    if (this.retry) clearTimeout(this.retry)
    if (this.watchdog) clearInterval(this.watchdog)
    this.retry = this.watchdog = null
    void this.teardown()
    this.setStatus('idle')
  }

  /** Ephemeral "I'm here" pulse. Skipped (never queued, never sent over REST) unless the live channel is joined. */
  async broadcastHeart(): Promise<void> {
    const channel = this.presenceChannel
    if (channel?.state !== 'joined') return
    await channel.send({ type: 'broadcast', event: 'heart', payload: { from: this.o.userId } })
  }

  private connect(): void {
    if (this.stopped) return
    if (navigator.onLine === false) return this.setStatus('offline')
    this.setStatus(this.attempt === 0 ? 'connecting' : 'reconnecting')
    void this.teardown().then(() => {
      if (this.stopped) return
      this.openDataChannel()
      this.openPresenceChannel()
    })
  }

  private openDataChannel(): void {
    const { client, userId, householdId, inbox } = this.o
    let channel = client.channel(`data:${householdId}:${userId}`)
    channel = channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events', filter: `recipient_id=eq.${userId}` }, (payload) => {
      void inbox.receive([payload.new])
    })
    for (const table of WATCHED_TABLES) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `household_id=eq.${householdId}` }, () => this.o.onTableChange(table))
    }
    channel.subscribe((status) => {
      if (this.stopped) return
      if (status === 'SUBSCRIBED') {
        this.attempt = 0
        this.lastLiveAt = Date.now()
        this.setStatus('live')
        void inbox.catchUp() // pick up everything missed while we were away
        WATCHED_TABLES.forEach((table) => this.o.onTableChange(table)) // and refresh state views
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        this.scheduleReconnect()
      }
    })
    this.dataChannel = channel
  }

  private openPresenceChannel(): void {
    const { client, userId, householdId } = this.o
    const channel = client.channel(`household:${householdId}`, { config: { private: true, presence: { key: userId }, broadcast: { self: false } } })
    const sync = () => {
      const others = Object.keys(channel.presenceState()).filter((key) => key !== userId)
      this.o.onPartnerPresence(others.length > 0)
    }
    channel.on('presence', { event: 'sync' }, sync)
    channel.on('broadcast', { event: 'heart' }, () => this.o.onPartnerHeart())
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') void channel.track({ at: Date.now() })
    })
    this.presenceChannel = channel
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.retry) return
    this.setStatus(navigator.onLine === false ? 'offline' : 'reconnecting')
    const delay = Math.min(1000 * 2 ** this.attempt, 30_000) * (0.75 + Math.random() * 0.5)
    this.attempt += 1
    this.retry = setTimeout(() => {
      this.retry = null
      this.connect()
    }, delay)
  }

  private async teardown(): Promise<void> {
    const channels = [this.dataChannel, this.presenceChannel].filter((c): c is RealtimeChannel => c !== null)
    this.dataChannel = this.presenceChannel = null
    await Promise.allSettled(channels.map((channel) => this.o.client.removeChannel(channel)))
  }

  /** Safety net: if we believe we are live but have been quiet and offline-flagged, recover. */
  private check(): void {
    if (this.stopped || navigator.onLine === false) return
    if (this.status !== 'live' && !this.retry) this.scheduleReconnect()
  }

  private readonly onOnline = (): void => {
    this.attempt = 0
    if (this.retry) clearTimeout(this.retry)
    this.retry = null
    this.connect()
  }
  private readonly onOffline = (): void => this.setStatus('offline')
  private readonly onVisibility = (): void => {
    if (document.visibilityState === 'visible' && this.status === 'live') {
      void this.o.inbox.catchUp()
      // Realtime cannot deliver filtered DELETEs, so refresh views whenever the app comes back to the foreground.
      WATCHED_TABLES.forEach((table) => this.o.onTableChange(table))
    } else if (document.visibilityState === 'visible' && Date.now() - this.lastLiveAt > 1000) this.check()
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.status === status) return
    this.status = status
    this.o.onStatus(status)
  }
}

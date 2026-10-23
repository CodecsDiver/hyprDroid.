import { playEffect, startRoomEffect, isRoomEffect } from '@/effects/bus'
import { cues, playSfx } from '@/audio/engine'
import { describeEvent, summariseEvents } from '@/domain/eventText'
import type { EventKind, LoveEvent } from '@/domain/events'
import { mayPlayMischief } from '@/domain/mischief'
import { spellEffect } from '@/domain/spells'
import { getInteraction } from '@/registry/interactionRegistry'
import { home, partnerName, refreshBondXp } from './household'
import { onEvent } from './live'
import { recordPartnerHeartTap } from './heartSync'
import { mischiefConsent } from './moods'
import { notifyIfAppropriate } from './notifications'
import { refreshNotes } from './notes'
import { refreshStickers, stickers, stickerVisual } from './stickers'
import { showToast } from './toasts'
import { openPanel } from './ui'
import { reactive } from 'vue'

export interface InboxEntry {
  id: string
  kind: EventKind
  emoji: string
  text: string
  at: string
}

/** The last few things the partner sent this session (live and while-you-were-away). */
export const inboxEntries = reactive<InboxEntry[]>([])

const digest: LoveEvent[] = []
let digestTimer: ReturnType<typeof setTimeout> | null = null

function remember(event: LoveEvent, emoji: string, text: string): void {
  inboxEntries.unshift({ id: event.id, kind: event.kind, emoji, text, at: event.createdAt })
  if (inboxEntries.length > 50) inboxEntries.length = 50
}

function queueDigest(event: LoveEvent): void {
  digest.push(event)
  if (digestTimer) clearTimeout(digestTimer)
  digestTimer = setTimeout(() => {
    digestTimer = null
    const batch = digest.splice(0)
    if (batch.length === 0) return
    showToast(`While you were away, ${partnerName.value} sent ${summariseEvents(batch)}.`, {
      tone: 'love',
      timeoutMs: 9000,
      action: { label: 'See', run: () => openPanel('love-ping') },
    })
    if (batch.some((event) => event.kind === 'note_placed')) void refreshNotes()
  }, 700)
}

async function showSticker(event: LoveEvent<'sticker'>): Promise<void> {
  if (stickers.value.length === 0) await refreshStickers()
  let sticker = stickers.value.find((candidate) => candidate.id === event.payload.sticker_id)
  if (!sticker) {
    await refreshStickers()
    sticker = stickers.value.find((candidate) => candidate.id === event.payload.sticker_id)
  }
  if (!sticker) return
  const visual = await stickerVisual(sticker)
  cues.stickerSqueak()
  playEffect({ type: 'sticker', url: visual.url, sprite: visual.style }, 2800)
}

/**
 * Registers what happens when each kind of event arrives. Returns a function that
 * removes every handler. Live events animate; old ones ("stale") are summarised.
 */
export function registerEventHandlers(): () => void {
  const name = () => partnerName.value
  const offs: (() => void)[] = []

  const common = (event: LoveEvent, stale: boolean): { emoji: string; text: string } | null => {
    const { emoji, text } = describeEvent(event, name())
    remember(event, emoji, text)
    void refreshBondXp()
    if (stale) {
      queueDigest(event)
      return null
    }
    return { emoji, text }
  }

  offs.push(onEvent('love_ping', (event, { stale }) => {
    const shown = common(event, stale)
    if (!shown) return
    const p = event.payload
    playEffect({ type: 'reaction', emoji: p.emoji ?? shown.emoji, animation: p.animation ?? 'float', ...(p.label ? { label: p.label } : {}) })
    playSfx('love')
    showToast(`${shown.emoji} ${shown.text}`, { tone: 'love' })
    void notifyIfAppropriate('love_ping', 'Signal Home', shown.text, 'love_ping')
  }))

  offs.push(onEvent('heart_tap', (event, { stale }) => {
    const shown = common(event, stale)
    if (!shown) return
    playEffect({ type: 'reaction', emoji: '💗', animation: 'pulse' })
    cues.bubblePops()
    if (recordPartnerHeartTap(Date.parse(event.createdAt))) {
      playEffect({ type: 'hearts-synced' }, 3600)
      playSfx('stage')
      showToast('Hearts synced! You both tapped the heart together.', { tone: 'love' })
    }
  }))

  offs.push(onEvent('hug', (event, { stale }) => {
    const shown = common(event, stale)
    if (!shown) return
    playEffect({ type: 'reaction', emoji: '🤗', animation: 'burst' })
    cues.hugSpin()
    showToast(`${shown.emoji} ${shown.text}`, { tone: 'love' })
    void notifyIfAppropriate('hug', 'Signal Home', shown.text, 'hug')
  }))

  offs.push(onEvent('sticker', async (event, { stale }) => {
    const shown = common(event, stale)
    if (!shown) return
    await showSticker(event)
    void notifyIfAppropriate('sticker', 'Signal Home', shown.text, 'sticker')
  }))

  offs.push(onEvent('love_note', (event, { stale }) => {
    const shown = common(event, stale)
    if (!shown) return
    playEffect({ type: 'note-card', from: name(), text: event.payload.body }, 7000)
    cues.chimeSweep()
    void notifyIfAppropriate('love_note', 'Signal Home', shown.text, 'love_note')
  }))

  offs.push(onEvent('note_placed', async (event, { stale }) => {
    const shown = common(event, stale)
    await refreshNotes()
    if (!shown) return
    const where = getInteraction(event.payload.object_id)?.label ?? 'the room'
    playSfx('open')
    showToast(`✉️ ${name()} hid a note for you on the ${where.toLowerCase()}.`, { tone: 'love', action: { label: 'Find it', run: () => openPanel('hidden-notes') } })
    void notifyIfAppropriate('note_placed', 'Signal Home', `${name()} hid a note for you`, 'note_placed')
  }))

  offs.push(onEvent('spell_cast', (event, { stale }) => {
    const shown = common(event, stale)
    if (!shown) return
    const p = event.payload
    playEffect({ type: 'spell', effect: p.effect, color: p.color ?? '#c9a7ff', name: p.name, ...(p.message ? { message: p.message } : {}) }, 4200)
    playSfx('glass')
    showToast(`${spellEffect(p.effect)?.emoji ?? '✨'} ${shown.text}`, { tone: 'love' })
    void notifyIfAppropriate('spell_cast', 'Signal Home', shown.text, 'spell_cast')
  }))

  offs.push(onEvent('mischief', (event, { stale }) => {
    const { emoji, text } = describeEvent(event, name())
    remember(event, emoji, text)
    if (stale) return // old pranks are never replayed
    const effect = event.payload.effect
    // Consent is re-checked on THIS device even though the server already checked.
    if (!mayPlayMischief(effect, mischiefConsent.value)) return
    if (isRoomEffect(effect)) startRoomEffect(effect)
    else playEffect({ type: 'mischief', effect, text }, 4500)
    playSfx('pop')
    showToast(`${emoji} ${text}`, { tone: 'info' })
  }))

  offs.push(onEvent('listening_invite', (event, { stale }) => {
    const shown = common(event, stale)
    if (!shown || !home.settings.notifyListeningInvites) return
    showToast(`${shown.emoji} ${shown.text}`, { tone: 'love', timeoutMs: 8000, action: { label: 'Listen', run: () => openPanel('listening') } })
  }))

  return () => offs.forEach((off) => off())
}

import type { EventKind, LoveEvent, Reaction } from './events'
import { mischiefEffect } from './mischief'
import { spellEffect } from './spells'

export interface ReactionMeta {
  emoji: string
  label: string
  /** "<Name> {verb}" */
  verb: string
}

export const REACTION_META: Readonly<Record<Reaction, ReactionMeta>> = {
  heart: { emoji: '❤️', label: 'Heart', verb: 'sent you a heart' },
  kiss: { emoji: '💋', label: 'Kiss', verb: 'sent you a kiss' },
  hug: { emoji: '🤗', label: 'Hug', verb: 'sent you a hug' },
  miss_you: { emoji: '🥺', label: 'Miss you', verb: 'misses you' },
  thinking_of_you: { emoji: '💭', label: 'Thinking of you', verb: 'is thinking of you' },
  comfort: { emoji: '🫂', label: 'Send comfort', verb: 'is sending you comfort' },
  goodnight: { emoji: '🌙', label: 'Goodnight', verb: 'says goodnight' },
  safe: { emoji: '✅', label: "I'm safe", verb: 'let you know they are safe' },
  custom: { emoji: '✨', label: 'Reaction', verb: 'sent you a reaction' },
}

export interface EventDescription {
  emoji: string
  text: string
}

/** Human-readable one-liner for an event, used by toasts, notifications and the digest. */
export function describeEvent(event: LoveEvent, senderName: string): EventDescription {
  const kind: EventKind = event.kind
  switch (kind) {
    case 'love_ping': {
      const p = event.payload as LoveEvent<'love_ping'>['payload']
      const meta = REACTION_META[p.reaction]
      const emoji = p.emoji ?? meta.emoji
      const text = p.reaction === 'custom' && p.label ? `${senderName} sent “${p.label}”` : `${senderName} ${meta.verb}`
      return { emoji, text: p.message ? `${text}: ${p.message}` : text }
    }
    case 'heart_tap':
      return { emoji: '💗', text: `${senderName} tapped the heart` }
    case 'hug': {
      const p = event.payload as LoveEvent<'hug'>['payload']
      return { emoji: '🤗', text: p.message ? `${senderName} sent you a hug: ${p.message}` : `${senderName} sent you a tiny hug` }
    }
    case 'sticker':
      return { emoji: '🖼️', text: `${senderName} sent you a sticker` }
    case 'love_note': {
      const p = event.payload as LoveEvent<'love_note'>['payload']
      return { emoji: p.voice === 'miss' ? '🥺' : '💌', text: `${senderName}: ${p.body}` }
    }
    case 'note_placed':
      return { emoji: '✉️', text: `${senderName} hid a note for you` }
    case 'spell_cast': {
      const p = event.payload as LoveEvent<'spell_cast'>['payload']
      return { emoji: spellEffect(p.effect)?.emoji ?? '✨', text: `${senderName} cast “${p.name}”${p.message ? `: ${p.message}` : ''}` }
    }
    case 'mischief': {
      const p = event.payload as LoveEvent<'mischief'>['payload']
      const effect = mischiefEffect(p.effect)
      return { emoji: effect?.emoji ?? '🎈', text: `${senderName} is up to something: ${effect?.label ?? 'mischief'}` }
    }
    case 'listening_invite': {
      const p = event.payload as LoveEvent<'listening_invite'>['payload']
      return { emoji: '🎧', text: p.track_title ? `${senderName} is playing “${p.track_title}”` : `${senderName} started a song` }
    }
  }
}

/** "3 pings, 1 hug, 2 notes" style summary for the while-you-were-away digest. */
export function summariseEvents(events: readonly Pick<LoveEvent, 'kind'>[]): string {
  const groups: [EventKind[], string, string][] = [
    [['love_ping', 'heart_tap'], 'ping', 'pings'],
    [['hug'], 'hug', 'hugs'],
    [['sticker'], 'sticker', 'stickers'],
    [['love_note'], 'love note', 'love notes'],
    [['note_placed'], 'hidden note', 'hidden notes'],
    [['spell_cast'], 'spell', 'spells'],
    [['listening_invite'], 'song', 'songs'],
    [['mischief'], 'surprise', 'surprises'],
  ]
  const parts: string[] = []
  for (const [kinds, one, many] of groups) {
    const count = events.filter((event) => kinds.includes(event.kind)).length
    if (count > 0) parts.push(`${count} ${count === 1 ? one : many}`)
  }
  return parts.join(', ')
}

/** Wording for events I sent myself, used in activity history ("You sent a hug"). */
export function describeOwnEvent(event: LoveEvent): EventDescription {
  switch (event.kind) {
    case 'love_ping': {
      const p = event.payload as LoveEvent<'love_ping'>['payload']
      const meta = REACTION_META[p.reaction]
      return { emoji: p.emoji ?? meta.emoji, text: `You sent “${p.label ?? meta.label}”` }
    }
    case 'heart_tap': return { emoji: '💗', text: 'You tapped the heart' }
    case 'hug': return { emoji: '🤗', text: 'You sent a hug' }
    case 'sticker': return { emoji: '🖼️', text: 'You sent a sticker' }
    case 'love_note': return { emoji: '💌', text: 'You sent a love note' }
    case 'note_placed': return { emoji: '✉️', text: 'You hid a note' }
    case 'spell_cast': return { emoji: '🔮', text: `You cast “${(event.payload as LoveEvent<'spell_cast'>['payload']).name}”` }
    case 'mischief': return { emoji: '🎈', text: 'You played a bit of mischief' }
    case 'listening_invite': return { emoji: '🎧', text: 'You started a song' }
  }
}

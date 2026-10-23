import { reactive } from 'vue'
import { mischiefEffect } from '@/domain/mischief'
import { reducedMotion } from '@/state/prefs'

/**
 * Visual effects bus. Anything can `playEffect(...)`; <EffectsLayer> renders
 * them. Under reduced motion every effect is replaced by a calm, static
 * banner — the information is kept, the movement is not.
 */

export type EffectSpec =
  | { type: 'reaction'; emoji: string; label?: string; animation: 'float' | 'burst' | 'pulse' | 'rain' }
  | { type: 'spell'; effect: string; color: string; name: string; message?: string }
  | { type: 'mischief'; effect: string; text?: string }
  | { type: 'sticker'; url: string; sprite?: Record<string, string> }
  | { type: 'hearts-synced' }
  | { type: 'note-card'; from: string; text: string }

export interface ActiveEffect {
  id: number
  spec: EffectSpec
  /** Pre-computed random numbers so rendering stays pure. */
  seed: number[]
  reduced: boolean
}

export const activeEffects = reactive<ActiveEffect[]>([])
/** Room-wide mischief (shake/flip/invert/glitch) currently applied to the whole UI. */
export const roomEffect = reactive<{ id: string | null }>({ id: null })

let nextId = 1
let roomTimer: ReturnType<typeof setTimeout> | null = null

export function playEffect(spec: EffectSpec, durationMs = 3200): void {
  const id = nextId++
  activeEffects.push({ id, spec, seed: Array.from({ length: 24 }, () => Math.random()), reduced: reducedMotion.value })
  if (activeEffects.length > 6) activeEffects.splice(0, activeEffects.length - 6)
  setTimeout(() => {
    const index = activeEffects.findIndex((effect) => effect.id === id)
    if (index >= 0) activeEffects.splice(index, 1)
  }, reducedMotion.value ? Math.min(durationMs, 2500) : durationMs)
}

const ROOM_EFFECTS = new Set(['shake_room', 'flip_room', 'invert_colors', 'fake_glitch'])

export function isRoomEffect(effect: string): boolean {
  return ROOM_EFFECTS.has(effect)
}

/** Applies a disruptive room effect briefly. Always cancellable via {@link stopRoomEffect}. */
export function startRoomEffect(effect: string): void {
  stopRoomEffect()
  if (reducedMotion.value) return // disruptive motion is never shown under reduced motion
  const definition = mischiefEffect(effect)
  roomEffect.id = effect
  roomTimer = setTimeout(stopRoomEffect, Math.min(definition?.durationMs ?? 2000, 3000))
}

export function stopRoomEffect(): void {
  if (roomTimer) clearTimeout(roomTimer)
  roomTimer = null
  roomEffect.id = null
}

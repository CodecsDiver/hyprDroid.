<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import PanelShell from '@/components/PanelShell.vue'
import { cues, unlockAudio } from '@/audio/engine'
import { fetchLoveNotes, type LoveNote, type Sticker } from '@/data/repos/loveUniverse'
import { FLOATING_WORDS, pickNote, STARTER_LOVE_NOTES, STARTER_MISS_NOTES } from '@/domain/loveUniverse'
import { playEffect } from '@/effects/bus'
import { home, myName, partnerName } from '@/state/household'
import { broadcastHeart, live, onPartnerHeart, sendEvent } from '@/state/live'
import { recordMyHeartTap } from '@/state/heartSync'
import { reducedMotion } from '@/state/prefs'
import { session } from '@/state/session'
import { refreshStickers, stickers, stickerVisual, type StickerVisual } from '@/state/stickers'
import { useAction, useResource } from '@/state/useAsync'
import type { PanelDefinition } from '../panels'
import NoteComposer from './NoteComposer.vue'
import StickerPicker from './StickerPicker.vue'

defineProps<{ definition: PanelDefinition }>()
defineEmits<{ close: [] }>()

const rnd = (min: number, max: number): number => min + Math.random() * (max - min)

// ------------------------------------------------------------------ content
const notes = useResource(fetchLoveNotes, [] as LoveNote[], ['love_notes'])
// The heart shows notes written BY the partner (this person is the recipient).
const fromPartner = (voice: 'love' | 'miss'): string[] => notes.data.value.filter((n) => n.authorId !== session.userId && n.voice === voice).map((n) => n.body)
const lovePool = computed(() => (fromPartner('love').length > 0 ? fromPartner('love') : [...STARTER_LOVE_NOTES]))
const missPool = computed(() => (fromPartner('miss').length > 0 ? fromPartner('miss') : [...STARTER_MISS_NOTES]))
const usingStarters = computed(() => fromPartner('love').length === 0)

const noteText = ref('Tap the heart to open your first note.')
const magicText = ref(`I love you ${myName.value}`)
const magicKey = ref(0)
const magicShown = ref(false)
let lastLove: number | null = null
let lastMiss: number | null = null

// ------------------------------------------------------------------ visual state
const heartClass = ref('')
const sparks = ref<{ id: number; x: number; y: number; bubble: boolean }[]>([])
const words = ref<{ id: number; text: string; left: number; top: number }[]>([])
const shooting = ref<{ id: number; left: number; top: number }[]>([])
const partnerHere = ref(false)
const mode = ref<'none' | 'stickers' | 'note'>('none')
let uid = 1
const timers = new Set<ReturnType<typeof setTimeout>>()
const later = (fn: () => void, ms: number): void => {
  const t = setTimeout(() => { timers.delete(t); fn() }, ms)
  timers.add(t)
}

const stars = Array.from({ length: 55 }, () => ({ left: `${rnd(0, 100)}%`, top: `${rnd(0, 100)}%`, delay: `${rnd(0, 3)}s` }))
const orbs = Array.from({ length: 18 }, () => ({ left: `${rnd(0, 100)}%`, top: `${rnd(80, 110)}%`, sway: `${rnd(-60, 60)}px`, time: `${rnd(8, 16)}s`, delay: `${rnd(0, 8)}s` }))

function showMagic(text = `I love you ${myName.value}`): void {
  magicText.value = text
  magicKey.value++
  magicShown.value = true
}

function burst(): void {
  if (reducedMotion.value) return
  for (let i = 0; i < 32; i++) {
    const id = uid++
    sparks.value.push({ id, x: rnd(-130, 130), y: rnd(-260, -20), bubble: false })
    later(() => (sparks.value = sparks.value.filter((s) => s.id !== id)), 1150)
  }
  for (let i = 0; i < 12; i++) {
    const id = uid++
    sparks.value.push({ id, x: rnd(-110, 110), y: rnd(-190, -10), bubble: true })
    later(() => (sparks.value = sparks.value.filter((s) => s.id !== id)), 820)
  }
}

function floatWord(): void {
  if (reducedMotion.value) return
  const id = uid++
  const pool = [...FLOATING_WORDS, myName.value, partnerName.value]
  words.value.push({ id, text: pool[Math.floor(Math.random() * pool.length)] ?? 'love', left: rnd(35, 65), top: rnd(48, 60) })
  later(() => (words.value = words.value.filter((w) => w.id !== id)), 1450)
}

async function popRandomSticker(): Promise<void> {
  if (stickers.value.length === 0) return
  const sticker = stickers.value[Math.floor(Math.random() * stickers.value.length)]
  if (!sticker) return
  try {
    const visual = await stickerVisual(sticker)
    cues.stickerSqueak()
    playEffect({ type: 'sticker', url: visual.url, sprite: visual.style }, 2800)
  } catch {
    /* sticker art unavailable */
  }
}

function setHeart(cls: string, ms: number): void {
  heartClass.value = ''
  requestAnimationFrame(() => {
    heartClass.value = cls
    later(() => (heartClass.value = ''), ms)
  })
}

// ------------------------------------------------------------------ shooting stars (original behaviour)
let shootingTimer: ReturnType<typeof setInterval> | null = null
function shootingStar(withSound: boolean): void {
  if (reducedMotion.value) return
  const id = uid++
  shooting.value.push({ id, left: rnd(55, 105), top: rnd(2, 32) })
  if (withSound) cues.shootingStar()
  later(() => (shooting.value = shooting.value.filter((s) => s.id !== id)), 1550)
}

// ------------------------------------------------------------------ actions
let lastHeartSent = 0
const sendHeart = useAction(async () => {
  if (Date.now() - lastHeartSent < 3000) return
  lastHeartSent = Date.now()
  await sendEvent('heart_tap', {})
})

function tapHeart(): void {
  unlockAudio()
  setHeart('pop', 550)
  const pick = pickNote(lovePool.value, Math.random, lastLove)
  if (pick) {
    lastLove = pick.index
    noteText.value = pick.text
  }
  showMagic()
  burst()
  cues.softBlip()
  cues.bubblePops()
  later(() => cues.sparkleArpeggio(), 70)
  later(() => cues.tinyKiss(), 210)
  floatWord()
  later(floatWord, 220)
  later(floatWord, 430)
  void popRandomSticker()
  // Let the partner feel it: a live pulse (ephemeral) and a durable event (delivered even if they're away).
  broadcastHeart()
  recordMyHeartTap()
  void sendHeart.run()
}

function anotherNote(): void {
  unlockAudio()
  const pick = pickNote(lovePool.value, Math.random, lastLove)
  if (pick) {
    lastLove = pick.index
    noteText.value = pick.text
  }
  showMagic()
  burst()
  floatWord()
  cues.chimeSweep()
  void popRandomSticker()
}

const hug = useAction(async () => {
  unlockAudio()
  setHeart('spin', 950)
  cues.hugSpin()
  const pick = pickNote(missPool.value, Math.random, lastMiss)
  if (pick) {
    lastMiss = pick.index
    noteText.value = pick.text
  }
  showMagic(`I miss you ${myName.value}`)
  later(() => showMagic(), 2200)
  burst()
  floatWord()
  later(floatWord, 250)
  void popRandomSticker()
  await sendEvent('hug', {})
})

const sendSticker = useAction(async (sticker: Sticker, visual: StickerVisual) => {
  await sendEvent('sticker', { sticker_id: sticker.id })
  cues.stickerSqueak()
  playEffect({ type: 'sticker', url: visual.url, sprite: visual.style }, 2800)
  mode.value = 'none'
}, { success: `Sticker on its way to ${partnerName.value}.` })

let offHeart: (() => void) | null = null
onMounted(() => {
  void refreshStickers().catch(() => {})
  later(() => {
    shootingStar(false)
    shootingTimer = setInterval(() => shootingStar(true), 4200)
  }, 1200)
  offHeart = onPartnerHeart(() => {
    partnerHere.value = true
    setHeart('pop', 550)
    cues.softBlip()
    later(() => (partnerHere.value = false), 3000)
  })
})
onBeforeUnmount(() => {
  offHeart?.()
  if (shootingTimer) clearInterval(shootingTimer)
  timers.forEach(clearTimeout)
  timers.clear()
})
</script>

<template>
  <PanelShell :title="definition.title" fullscreen bare @close="$emit('close')">
    <div class="universe" :class="{ 'universe--reduced': reducedMotion }">
      <div class="layer"><span v-for="(star, i) in stars" :key="i" class="star" :style="{ left: star.left, top: star.top, animationDelay: star.delay }" /></div>
      <div class="layer"><span v-for="(orb, i) in orbs" :key="i" class="orb" :style="{ left: orb.left, top: orb.top, '--sway': orb.sway, '--time': orb.time, animationDelay: orb.delay }" /></div>
      <div class="layer"><span v-for="s in shooting" :key="s.id" class="shoot" :style="{ left: `${s.left}%`, top: `${s.top}%` }" /></div>
      <div class="layer layer--sparks"><span v-for="s in sparks" :key="s.id" :class="s.bubble ? 'bubble' : 'spark'" :style="{ '--x': `${s.x}px`, '--y': `${s.y}px` }" /></div>
      <div class="layer"><span v-for="w in words" :key="w.id" class="word" :style="{ left: `${w.left}%`, top: `${w.top}%` }">{{ w.text }}</span></div>

      <button type="button" class="back btn btn--small btn--quiet" aria-label="Back to the room" @click="$emit('close')">← Room</button>

      <main class="app">
        <div class="content">
          <div class="top">
            <div class="badge">A tiny universe for us</div>
            <h1>Our Little Love Universe</h1>
            <p class="subtitle">Tap the heart for a tiny love note, a sparkle burst, and a reminder that you are my favorite person.</p>
          </div>

          <div class="middle">
            <div class="heart-zone">
              <div class="glow" />
              <button type="button" class="heart" :class="[heartClass, { 'heart--partner': partnerHere }]" aria-label="Tap the heart" @click="tapHeart"><span class="core" /></button>
            </div>
            <p v-if="partnerHere" class="partner" role="status">{{ partnerName }} is tapping the heart too 💗</p>
            <div :key="magicKey" class="magic" :class="{ show: magicShown }" role="status" aria-live="polite">{{ magicShown ? magicText : '' }}</div>
            <div class="note-card">
              <div class="note-label">A note from {{ partnerName }} to you</div>
              <div class="love-note" aria-live="polite">{{ noteText }}</div>
              <p v-if="usingStarters" class="starter">These are starter notes. Notes {{ partnerName }} writes will appear here.</p>
            </div>
          </div>

          <div class="controls">
            <button type="button" class="control" @click="anotherNote">Open another love note</button>
            <button type="button" class="control secondary" :disabled="hug.busy.value" @click="hug.run()">Send a tiny hug</button>
            <div class="two">
              <button type="button" class="control small" :aria-expanded="mode === 'stickers'" @click="mode = mode === 'stickers' ? 'none' : 'stickers'">Stickers</button>
              <button type="button" class="control small" :aria-expanded="mode === 'note'" @click="mode = mode === 'note' ? 'none' : 'note'">Write a note</button>
            </div>
            <div v-if="mode !== 'none'" class="drawer">
              <StickerPicker v-if="mode === 'stickers'" @pick="(s, v) => sendSticker.run(s, v)" />
              <NoteComposer v-else @sent="mode = 'none'" />
            </div>
            <p class="status" role="status">
              <template v-if="live.status === 'offline'">You're offline — hearts, hugs and notes are saved and will be delivered when you're back.</template>
              <template v-else-if="live.pending > 0">{{ live.pending }} waiting to send…</template>
              <template v-else-if="!home.partner">{{ partnerName }} hasn't joined yet.</template>
            </p>
            <div class="footer">Made for {{ myName }}, with love, moonlight, sparkles, and one very dramatic heart.</div>
          </div>
        </div>
      </main>
    </div>
  </PanelShell>
</template>

<style scoped>
.universe { position: relative; min-height: 100%; height: 100%; overflow-y: auto; display: flex; align-items: flex-start; justify-content: center; padding: calc(var(--safe-top) + 16px) 16px calc(var(--safe-bottom) + 16px); color: #fff; font-family: var(--font-serif); background: radial-gradient(circle at 18% 10%, rgba(255, 177, 215, 0.26), transparent 32%), radial-gradient(circle at 84% 92%, rgba(201, 187, 255, 0.22), transparent 34%), linear-gradient(145deg, #080812, #17142a 55%, #251935); }
.layer { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.layer--sparks { z-index: 4; }
.back { position: absolute; z-index: 6; top: calc(var(--safe-top) + 12px); left: 12px; }
.app { position: relative; width: min(100%, 430px); min-height: 670px; margin: auto; overflow: hidden; border-radius: 34px; padding: 24px 20px; background: rgba(13, 13, 30, 0.88); border: 1px solid rgba(255, 255, 255, 0.16); box-shadow: 0 25px 80px rgba(0, 0, 0, 0.55); z-index: 2; }
.content { position: relative; min-height: 618px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; text-align: center; gap: var(--space-3); }
.badge { display: inline-block; margin-bottom: 14px; padding: 7px 13px; border-radius: 999px; background: rgba(255, 214, 232, 0.13); border: 1px solid rgba(255, 214, 232, 0.25); color: #ffd8e8; font-family: Arial, sans-serif; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; }
h1 { font-family: var(--font-serif); font-size: 34px; line-height: 1.04; margin-bottom: 10px; color: #fff0f7; font-weight: 700; text-shadow: 0 0 24px rgba(255, 184, 214, 0.42); }
.subtitle { max-width: 310px; margin: 0 auto; font-family: Arial, sans-serif; font-size: 15px; line-height: 1.55; color: rgba(255, 255, 255, 0.76); }
.middle { width: 100%; display: grid; justify-items: center; }
.heart-zone { position: relative; width: 260px; height: 240px; display: flex; align-items: center; justify-content: center; margin: 18px 0 8px; }
.glow { position: absolute; width: 252px; height: 252px; border-radius: 50%; background: radial-gradient(circle, rgba(255, 241, 181, 0.16), transparent 35%), radial-gradient(circle, rgba(255, 143, 201, 0.3), transparent 63%), radial-gradient(circle, rgba(255, 214, 232, 0.2), transparent 75%); animation: breathe 3.2s infinite ease-in-out; }
.heart { position: relative; width: 124px; height: 124px; border: none; background: transparent; cursor: pointer; transform: rotate(-45deg); filter: drop-shadow(0 20px 34px rgba(255, 78, 164, 0.5)) drop-shadow(0 0 32px rgba(255, 173, 218, 0.52)); animation: heartbeat 1.45s infinite ease-in-out; }
.heart:focus-visible { box-shadow: none; filter: drop-shadow(0 0 0 #fff) drop-shadow(0 0 14px #ffd98d) drop-shadow(0 20px 34px rgba(255, 78, 164, 0.5)); }
.core, .heart::before, .heart::after { position: absolute; background: radial-gradient(circle at 32% 26%, rgba(255, 255, 255, 0.88), transparent 16%), radial-gradient(circle at 68% 75%, rgba(255, 224, 238, 0.55), transparent 30%), linear-gradient(135deg, #ffb5d9 0%, #ff5fb0 42%, #ff2f97 74%, #ff84c6 100%); }
.core { inset: 24px 0 0 0; border-radius: 22px; }
.heart::before, .heart::after { content: ''; width: 124px; height: 124px; border-radius: 50%; }
.heart::before { left: 0; top: -37px; }
.heart::after { left: 37px; top: 0; }
.heart.pop { animation: popBeat 0.55s ease-out; }
.heart.spin { animation: hugSpin 0.95s cubic-bezier(0.2, 0.9, 0.25, 1.2); }
.partner { margin: 0; font-family: Arial, sans-serif; font-size: 13px; color: #ffd8e8; }
.magic { min-height: 62px; font-size: 31px; line-height: 1.12; font-weight: 700; letter-spacing: 0.02em; background: linear-gradient(90deg, #ffe8a3, #fff7cf, #e9be63, #fff1a8); background-size: 240% auto; color: transparent; -webkit-background-clip: text; background-clip: text; opacity: 0; transform: translateY(12px) scale(0.98); }
.magic.show { animation: appearMagic 1.1s ease forwards, shimmer 2.5s linear infinite; }
.note-card { position: relative; width: 100%; min-height: 144px; margin-top: 12px; padding: 20px 18px; border-radius: 26px; background: radial-gradient(circle at 15% 10%, rgba(255, 240, 187, 0.14), transparent 32%), rgba(255, 255, 255, 0.09); border: 1px solid rgba(255, 255, 255, 0.16); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 14px 32px rgba(255, 184, 214, 0.09); }
.note-card::before { content: '♡'; position: absolute; right: 18px; top: 12px; color: rgba(255, 216, 232, 0.55); font-size: 24px; }
.note-label { margin-bottom: 9px; font-family: Arial, sans-serif; color: #ffd8e8; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; }
.love-note { font-size: 18px; line-height: 1.58; color: rgba(255, 255, 255, 0.92); overflow-wrap: anywhere; }
.starter { margin: 10px 0 0; font-family: Arial, sans-serif; font-size: 11px; color: rgba(255, 255, 255, 0.5); }
.controls { width: 100%; display: grid; gap: 10px; margin-top: 16px; }
.control { width: 100%; border: none; border-radius: 18px; padding: 14px 16px; color: #261426; font-family: Arial, sans-serif; font-size: 15px; font-weight: 800; background: linear-gradient(135deg, #ffd8e8, #d8d2ff); box-shadow: 0 12px 28px rgba(255, 184, 214, 0.18); cursor: pointer; min-height: var(--tap-target); }
.control.secondary { background: linear-gradient(135deg, #fff0bb, #ffd8e8); }
.control.small { padding: 10px 12px; font-size: 14px; background: rgba(255, 255, 255, 0.14); color: #fff; box-shadow: none; border: 1px solid rgba(255, 255, 255, 0.2); }
.control:disabled { opacity: 0.6; }
.control:focus-visible { box-shadow: 0 0 0 3px #080812, 0 0 0 5px #ffd98d; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.drawer { border: 1px solid rgba(255, 255, 255, 0.16); border-radius: 18px; padding: 12px; background: rgba(0, 0, 0, 0.25); }
.status { min-height: 1.2em; margin: 0; font-family: Arial, sans-serif; font-size: 12px; color: #ffd8e8; }
.footer { margin-top: 4px; font-size: 12px; color: rgba(255, 255, 255, 0.48); }

.star { position: absolute; width: 3px; height: 3px; border-radius: 50%; background: rgba(255, 255, 255, 0.85); box-shadow: 0 0 12px rgba(255, 255, 255, 0.9); animation: twinkle 3s infinite ease-in-out; }
.orb { position: absolute; width: 9px; height: 9px; border-radius: 50%; background: rgba(255, 216, 232, 0.7); box-shadow: 0 0 18px rgba(255, 216, 232, 0.9); animation: driftOrb var(--time) linear infinite; opacity: 0.75; }
.shoot { position: absolute; width: 120px; height: 2px; border-radius: 999px; background: linear-gradient(90deg, rgba(255, 255, 255, 0), rgba(255, 241, 168, 0.95), rgba(255, 255, 255, 0)); box-shadow: 0 0 18px rgba(255, 241, 168, 0.9); transform: rotate(-28deg); animation: shootStar 1.45s ease-out forwards; opacity: 0; }
.shoot::after { content: '✦'; position: absolute; right: -6px; top: -10px; color: #fff7cf; font-size: 18px; text-shadow: 0 0 14px rgba(255, 241, 168, 0.95); }
.spark, .bubble { position: absolute; left: 50%; top: 52%; }
.spark { width: 8px; height: 8px; border-radius: 50%; background: #fff1a8; box-shadow: 0 0 14px #fff1a8, 0 0 28px rgba(255, 216, 232, 0.65); animation: sparkleFly 1100ms ease-out forwards; }
.spark::before, .spark::after { content: ''; position: absolute; left: 50%; top: 50%; background: rgba(255, 255, 255, 0.9); transform: translate(-50%, -50%) rotate(45deg); border-radius: 999px; }
.spark::after { width: 18px; height: 2px; }
.spark::before { width: 2px; height: 18px; }
.bubble { width: 18px; height: 18px; border-radius: 50%; border: 2px solid rgba(255, 216, 232, 0.8); box-shadow: 0 0 18px rgba(255, 216, 232, 0.65), inset 0 0 10px rgba(255, 255, 255, 0.45); animation: bubblePop 760ms ease-out forwards; }
.word { position: absolute; color: #ffe8a3; font-weight: 800; font-size: 14px; text-shadow: 0 0 12px rgba(255, 232, 163, 0.8); animation: floatWord 1.4s ease-out forwards; }

@keyframes breathe { 0%, 100% { transform: scale(0.96); opacity: 0.65; } 50% { transform: scale(1.09); opacity: 1; } }
@keyframes heartbeat { 0%, 100% { transform: rotate(-45deg) scale(1); } 18% { transform: rotate(-45deg) scale(1.08); } 32% { transform: rotate(-45deg) scale(0.98); } 48% { transform: rotate(-45deg) scale(1.13); } 64% { transform: rotate(-45deg) scale(1); } }
@keyframes popBeat { 0% { transform: rotate(-45deg) scale(1); } 40% { transform: rotate(-45deg) scale(1.24); } 100% { transform: rotate(-45deg) scale(1); } }
@keyframes hugSpin { 0% { transform: rotate(-45deg) scale(1); } 35% { transform: rotate(115deg) scale(1.18); } 70% { transform: rotate(285deg) scale(1.1); } 100% { transform: rotate(315deg) scale(1); } }
@keyframes appearMagic { to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes shimmer { to { background-position: 240% center; } }
@keyframes twinkle { 0%, 100% { opacity: 0.25; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.25); } }
@keyframes driftOrb { 0% { transform: translateY(60px) translateX(0) scale(0.65); opacity: 0; } 18% { opacity: 0.75; } 100% { transform: translateY(-720px) translateX(var(--sway)) scale(1.2); opacity: 0; } }
@keyframes shootStar { 0% { opacity: 0; transform: translate(0, 0) rotate(-28deg) scale(0.75); } 15% { opacity: 1; } 100% { opacity: 0; transform: translate(-330px, 210px) rotate(-28deg) scale(1.05); } }
@keyframes sparkleFly { 0% { opacity: 1; transform: translate(0, 0) scale(0.5); } 100% { opacity: 0; transform: translate(var(--x), var(--y)) scale(1.3); } }
@keyframes bubblePop { 0% { opacity: 0; transform: translate(0, 0) scale(0.25); } 35% { opacity: 1; } 82% { opacity: 0.78; transform: translate(var(--x), var(--y)) scale(1.15); } 100% { opacity: 0; transform: translate(var(--x), var(--y)) scale(1.7); } }
@keyframes floatWord { 0% { opacity: 0; transform: translateY(10px) scale(0.9); } 25% { opacity: 1; } 100% { opacity: 0; transform: translateY(-65px) scale(1.08); } }

/* Reduced motion: keep the content, drop the movement. */
.universe--reduced .star, .universe--reduced .orb, .universe--reduced .glow, .universe--reduced .heart { animation: none; }
.universe--reduced .heart.pop, .universe--reduced .heart.spin { animation: none; }
.universe--reduced .magic.show { animation: none; opacity: 1; transform: none; }
.universe--reduced .orb { display: none; }
@media (prefers-reduced-motion: reduce) {
  :global(:root[data-motion='auto']) .universe .star, :global(:root[data-motion='auto']) .universe .glow, :global(:root[data-motion='auto']) .universe .heart { animation: none; }
  :global(:root[data-motion='auto']) .universe .magic.show { animation: none; opacity: 1; transform: none; }
}
</style>

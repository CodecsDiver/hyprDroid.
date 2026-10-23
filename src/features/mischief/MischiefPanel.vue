<script setup lang="ts">
import PanelShell from '@/components/PanelShell.vue'
import { playSfx } from '@/audio/engine'
import { MISCHIEF_EFFECTS, type MischiefEffect } from '@/domain/mischief'
import { isRoomEffect, playEffect, startRoomEffect, stopRoomEffect, roomEffect } from '@/effects/bus'
import { home, partnerName } from '@/state/household'
import { sendEvent, live } from '@/state/live'
import { mischiefConsent } from '@/state/moods'
import { prefs } from '@/state/prefs'
import { useAction } from '@/state/useAsync'
import { updateSettings } from '@/state/household'
import type { PanelDefinition } from '../panels'

defineProps<{ definition: PanelDefinition }>()
defineEmits<{ close: [] }>()

const setConsent = useAction(async (changes: { allowMischief?: boolean; allowDisruptiveMischief?: boolean }) => {
  // Turning mischief off also turns the stronger opt-in off.
  const next = changes.allowMischief === false ? { ...changes, allowDisruptiveMischief: false } : changes
  await updateSettings(next)
})

const send = useAction(async (effect: MischiefEffect) => {
  await sendEvent('mischief', { effect: effect.id })
  playSfx('pop')
}, { success: 'Mischief sent. If they have not opted in, you will be told.' })

/** Preview on yourself: same effects, same safety rules (disruptive ones are short and stoppable). */
function preview(effect: MischiefEffect): void {
  playSfx('pop')
  if (isRoomEffect(effect.id)) startRoomEffect(effect.id)
  else playEffect({ type: 'mischief', effect: effect.id, text: `Boo, ${home.me?.name ?? 'you'}!` }, effect.durationMs)
}
</script>

<template>
  <PanelShell :title="definition.title" :icon="definition.icon" @close="$emit('close')">
    <div class="stack">
      <section class="card stack" aria-labelledby="consent-h">
        <h3 id="consent-h">Your say comes first</h3>
        <p class="hint">Nothing here happens to you unless you turn it on. {{ partnerName }} can only send you what you allow.</p>
        <label class="switch">
          <input type="checkbox" :checked="home.settings.allowMischief" :disabled="setConsent.busy.value" @change="setConsent.run({ allowMischief: ($event.target as HTMLInputElement).checked })" />
          <span>Let {{ partnerName }} send me playful surprises</span>
        </label>
        <label class="switch" :class="{ 'switch--off': !home.settings.allowMischief }">
          <input type="checkbox" :checked="home.settings.allowDisruptiveMischief" :disabled="!home.settings.allowMischief || setConsent.busy.value" @change="setConsent.run({ allowDisruptiveMischief: ($event.target as HTMLInputElement).checked })" />
          <span>Also allow disruptive ones (room shake, flip, colour swap, fake glitch)</span>
        </label>
        <label class="switch">
          <input v-model="prefs.mischiefPaused" type="checkbox" />
          <span>Pause all mischief on this device for now</span>
        </label>
        <p v-if="!mischiefConsent.allowMischief || mischiefConsent.paused" class="hint" role="status">Mischief is currently off for you.</p>
        <button v-if="roomEffect.id" type="button" class="btn btn--danger" @click="stopRoomEffect">Stop the current effect</button>
      </section>

      <section class="stack" aria-labelledby="send-h">
        <h3 id="send-h">Send some mischief to {{ partnerName }}</h3>
        <p v-if="live.status === 'offline'" class="hint" role="status">You're offline — mischief will be sent when you reconnect, and expires after an hour.</p>
        <ul class="plain" role="list">
          <li v-for="effect in MISCHIEF_EFFECTS" :key="effect.id" class="card effect">
            <span class="effect__emoji" aria-hidden="true">{{ effect.emoji }}</span>
            <div class="grow">
              <p class="effect__name">{{ effect.label }} <span v-if="effect.disruptive" class="chip">disruptive</span></p>
              <p class="hint">{{ effect.description }}</p>
            </div>
            <div class="stack tight">
              <button type="button" class="btn btn--small btn--primary" :disabled="send.busy.value" @click="send.run(effect)">Send</button>
              <button type="button" class="btn btn--small btn--quiet" @click="preview(effect)">Try on me</button>
            </div>
          </li>
        </ul>
        <p class="hint">Pranks are harmless, brief and never replayed after the fact. {{ partnerName }}'s device checks their consent again before playing anything.</p>
      </section>
    </div>
  </PanelShell>
</template>

<style scoped>
.switch { display: flex; gap: var(--space-3); align-items: flex-start; font-size: var(--text-sm); min-height: var(--tap-target); }
.switch input { width: 22px; height: 22px; margin-top: 2px; accent-color: var(--color-gold); flex: none; }
.switch--off { opacity: 0.6; }
.plain { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--space-2); }
.effect { display: flex; gap: var(--space-3); align-items: center; }
.effect__emoji { font-size: 1.8rem; }
.effect__name { margin: 0; font-weight: 700; }
.grow { flex: 1; min-width: 0; }
.tight { gap: var(--space-1); }
h3 { margin-top: var(--space-1); }
</style>

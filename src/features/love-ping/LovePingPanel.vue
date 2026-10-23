<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import PanelShell from '@/components/PanelShell.vue'
import ResourceView from '@/components/ResourceView.vue'
import { cues, playSfx } from '@/audio/engine'
import { addPreset, deletePreset, fetchPresets } from '@/data/repos/reactions'
import { fetchRecentEvents } from '@/data/repos/events'
import { describeEvent, describeOwnEvent, REACTION_META } from '@/domain/eventText'
import { parseEventRow, REACTIONS, REACTION_ANIMATIONS, type Reaction, type ReactionAnimation } from '@/domain/events'
import { roseProgress } from '@/domain/rose'
import { relativeTime } from '@/domain/time'
import { playEffect } from '@/effects/bus'
import { home, partnerName } from '@/state/household'
import { inboxEntries } from '@/state/eventHandlers'
import { live, sendEvent } from '@/state/live'
import { session } from '@/state/session'
import { useAction, useResource } from '@/state/useAsync'
import type { PanelDefinition } from '../panels'

defineProps<{ definition: PanelDefinition }>()
defineEmits<{ close: [] }>()

const message = ref('')
const rose = computed(() => roseProgress(home.bondXp))
const quick = REACTIONS.filter((reaction): reaction is Exclude<Reaction, 'custom'> => reaction !== 'custom')

const presets = useResource(() => fetchPresets(session.userId ?? ''), [] as Awaited<ReturnType<typeof fetchPresets>>)
const recent = useResource(async () => {
  const rows = await fetchRecentEvents(['love_ping', 'hug', 'heart_tap', 'sticker', 'love_note'], 30)
  return rows.map(parseEventRow).filter((event) => event !== null)
}, [] as NonNullable<ReturnType<typeof parseEventRow>>[], [])
watch(() => inboxEntries.length, () => void recent.reload())

const history = computed(() =>
  recent.data.value.map((event) => {
    const mine = event.senderId === session.userId
    const described = mine ? describeOwnEvent(event) : describeEvent(event, partnerName.value)
    return { id: event.id, mine, emoji: described.emoji, text: described.text, when: relativeTime(event.createdAt) }
  }),
)

let lastSend = 0
const send = useAction(async (reaction: Reaction, extra: { label?: string; emoji?: string; animation?: ReactionAnimation } = {}) => {
  if (Date.now() - lastSend < 350) return // protects against accidental double taps
  lastSend = Date.now()
  const meta = REACTION_META[reaction]
  const payload = { reaction, ...extra, ...(message.value.trim() ? { message: message.value.trim() } : {}) }
  await sendEvent('love_ping', payload)
  message.value = ''
  playEffect({ type: 'reaction', emoji: extra.emoji ?? meta.emoji, animation: extra.animation ?? 'float' }, 2200)
  playSfx('love')
  cues.tinyKiss()
  setTimeout(() => void recent.reload(), 900)
})

const form = ref({ label: '', emoji: '💖', animation: 'float' as ReactionAnimation })
const addCustom = useAction(async () => {
  if (!home.household) return
  await addPreset(home.household.id, form.value)
  form.value = { label: '', emoji: '💖', animation: 'float' }
  await presets.reload()
}, { success: 'Reaction added.' })
const remove = useAction(async (id: string) => {
  await deletePreset(id)
  await presets.reload()
})
</script>

<template>
  <PanelShell :title="definition.title" :icon="definition.icon" @close="$emit('close')">
    <section class="stack" aria-labelledby="rose-h">
      <h3 id="rose-h" class="visually-hidden">The rose</h3>
      <div class="card rose">
        <div class="rose__row"><strong>{{ rose.label }}</strong><span class="hint">stage {{ rose.stage }} / 5</span></div>
        <div class="bar" role="progressbar" aria-label="Rose growth" :aria-valuenow="Math.round(rose.progress * 100)" aria-valuemin="0" aria-valuemax="100">
          <div class="bar__fill" :style="{ width: `${rose.progress * 100}%` }" />
        </div>
        <p class="hint">Every ping helps the rose grow for both of you ({{ home.bondXp }} bond{{ rose.nextAt ? `, next stage at ${rose.nextAt}` : '' }}).</p>
      </div>

      <p v-if="!home.partner" class="error-text" role="alert">{{ partnerName === 'your partner' ? 'Your partner has not joined yet' : '' }} — pings are sent once they join.</p>
      <p v-if="live.status === 'offline'" class="hint" role="status">You're offline. Pings are saved on this device and will be sent when you reconnect.</p>

      <div class="field">
        <label for="ping-message">Add a message (optional)</label>
        <input id="ping-message" v-model="message" class="input" maxlength="280" autocomplete="off" :placeholder="`Say something to ${partnerName}…`" />
      </div>

      <div class="grid-2" role="group" aria-label="Send a ping">
        <button v-for="reaction in quick" :key="reaction" type="button" class="btn" :disabled="send.busy.value" @click="send.run(reaction)">
          <span aria-hidden="true">{{ REACTION_META[reaction].emoji }}</span> {{ REACTION_META[reaction].label }}
        </button>
      </div>

      <h3>Your reactions</h3>
      <ResourceView :loading="presets.loading.value" :error="presets.error.value" @retry="presets.reload">
        <EmptyState v-if="presets.data.value.length === 0" emoji="✨" title="No custom reactions yet" hint="Make your own below — a private joke, a pet name, anything." />
        <ul v-else class="list" role="list">
          <li v-for="preset in presets.data.value" :key="preset.id" class="row">
            <button type="button" class="btn grow" :disabled="send.busy.value" @click="send.run('custom', { label: preset.label, emoji: preset.emoji, animation: preset.animation })">
              <span aria-hidden="true">{{ preset.emoji }}</span> {{ preset.label }}
            </button>
            <button type="button" class="btn btn--small btn--quiet" :aria-label="`Delete reaction ${preset.label}`" @click="remove.run(preset.id)">🗑</button>
          </li>
        </ul>
      </ResourceView>

      <form class="card stack" @submit.prevent="addCustom.run()">
        <h4>New reaction</h4>
        <div class="row">
          <div class="field"><label for="r-emoji">Emoji</label><input id="r-emoji" v-model="form.emoji" class="input emoji" maxlength="8" required /></div>
          <div class="field grow"><label for="r-label">Name</label><input id="r-label" v-model="form.label" class="input" maxlength="24" required /></div>
        </div>
        <div class="field">
          <label for="r-anim">Animation</label>
          <select id="r-anim" v-model="form.animation" class="input"><option v-for="a in REACTION_ANIMATIONS" :key="a" :value="a">{{ a }}</option></select>
        </div>
        <button type="submit" class="btn btn--small" :disabled="addCustom.busy.value">Add reaction</button>
      </form>

      <h3>Recent</h3>
      <ResourceView :loading="recent.loading.value" :error="recent.error.value" @retry="recent.reload">
        <EmptyState v-if="history.length === 0" emoji="💌" title="Nothing yet" hint="Send the first ping." />
        <ul v-else class="list" role="list">
          <li v-for="item in history" :key="item.id" class="card history" :class="{ 'history--mine': item.mine }">
            <span aria-hidden="true">{{ item.emoji }}</span>
            <span class="grow">{{ item.text }}</span>
            <time class="hint">{{ item.when }}</time>
          </li>
        </ul>
      </ResourceView>
    </section>
  </PanelShell>
</template>

<style scoped>
.rose__row { display: flex; justify-content: space-between; align-items: baseline; }
.bar { height: 9px; border-radius: var(--radius-pill); background: rgba(255, 255, 255, 0.14); overflow: hidden; margin: var(--space-2) 0; }
.bar__fill { height: 100%; background: linear-gradient(90deg, var(--color-rose), var(--color-gold)); border-radius: inherit; transition: width var(--motion-slow) var(--ease-out); }
.list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-2); }
.grow { flex: 1; }
.emoji { width: 5rem; text-align: center; }
.history { display: flex; gap: var(--space-2); align-items: center; font-size: var(--text-sm); padding: var(--space-2) var(--space-3); }
.history--mine { opacity: 0.8; }
h3, h4 { margin-top: var(--space-2); }
</style>

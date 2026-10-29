<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PanelShell from '@/components/PanelShell.vue'
import { importPostcard } from '@/local/backend'
import { createPostcard, decodePostcard, encodePostcard, postcardLink, type PostcardKind } from '@/local/postcards'
import { REACTION_META } from '@/domain/eventText'
import { partnerName } from '@/state/household'
import { session } from '@/state/session'
import { showToast } from '@/state/toasts'
import { useAction } from '@/state/useAsync'
import type { PanelDefinition } from '../panels'

defineProps<{ definition: PanelDefinition }>()
defineEmits<{ close: [] }>()

const CHOICES: { kind: PostcardKind; reaction?: string; label: string; emoji: string }[] = [
  { kind: 'love_ping', reaction: 'heart', label: 'A heart', emoji: REACTION_META.heart.emoji },
  { kind: 'love_ping', reaction: 'kiss', label: 'A kiss', emoji: REACTION_META.kiss.emoji },
  { kind: 'love_ping', reaction: 'miss_you', label: 'Missing you', emoji: REACTION_META.miss_you.emoji },
  { kind: 'love_ping', reaction: 'goodnight', label: 'Goodnight', emoji: REACTION_META.goodnight.emoji },
  { kind: 'hug', label: 'A hug', emoji: '🤗' },
  { kind: 'heart_tap', label: 'A heart tap', emoji: '💗' },
]

const choice = ref(0)
const message = ref('')
const code = ref('')
const incoming = ref('')
const imported = ref<string | null>(null)

const link = computed(() => (code.value ? postcardLink(code.value, location.href) : ''))

const write = useAction(async () => {
  if (!session.userId) return
  const picked = CHOICES[choice.value]!
  const payload = picked.kind === 'love_ping' ? { reaction: picked.reaction, ...(message.value.trim() ? { message: message.value.trim() } : {}) } : {}
  code.value = encodePostcard(createPostcard({ id: crypto.randomUUID(), from: session.userId, kind: picked.kind, payload, now: Date.now() }))
})

async function copy(text: string, what: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    showToast(`${what} copied.`, { tone: 'success' })
  } catch {
    showToast('Your browser would not copy it. Select the text and copy it by hand.', { tone: 'warning' })
  }
}

const open = useAction(async () => {
  const card = decodePostcard(incoming.value, Date.now())
  const done = await importPostcard(card)
  imported.value = `Delivered from ${done.from} to ${done.to}. ${done.to} will see it the next time they are in this home.`
  incoming.value = ''
  if (location.hash.startsWith('#postcard=')) history.replaceState(null, '', location.href.split('#')[0])
})

onMounted(() => {
  if (location.hash.startsWith('#postcard=')) incoming.value = location.hash.slice(1)
})
</script>

<template>
  <PanelShell :title="definition.title" :icon="definition.icon" @close="$emit('close')">
    <div class="stack">
      <p class="hint">
        Each device keeps its own home, so a message can’t travel by itself. A postcard is a short code you send to {{ partnerName }} however you like
        (text, email, anything). When they paste it into their copy, it shows up as an ordinary message.
      </p>

      <section class="stack" aria-labelledby="write-h">
        <h3 id="write-h">Write a postcard to {{ partnerName }}</h3>
        <form class="stack" @submit.prevent="write.run()">
          <div class="field">
            <label for="card-kind">What to send</label>
            <select id="card-kind" v-model.number="choice" class="input"><option v-for="(c, i) in CHOICES" :key="i" :value="i">{{ c.emoji }} {{ c.label }}</option></select>
          </div>
          <div v-if="CHOICES[choice]?.kind === 'love_ping'" class="field">
            <label for="card-msg">A few words (optional)</label>
            <input id="card-msg" v-model="message" class="input" maxlength="140" />
          </div>
          <button type="submit" class="btn btn--primary" :disabled="write.busy.value">Make the postcard</button>
        </form>
        <div v-if="code" class="card stack">
          <label for="card-code" class="hint">Send this whole code:</label>
          <textarea id="card-code" class="input code" rows="3" readonly :value="code" @focus="($event.target as HTMLTextAreaElement).select()" />
          <div class="row">
            <button type="button" class="btn btn--small" @click="copy(code, 'The code')">Copy code</button>
            <button type="button" class="btn btn--small btn--quiet" @click="copy(link, 'The link')">Copy as a link</button>
          </div>
          <p class="hint">A link only works if they have the same file at the same address, so the code is the safe choice. Postcards expire after 30 days.</p>
        </div>
      </section>

      <section class="stack" aria-labelledby="open-h">
        <h3 id="open-h">Open a postcard you received</h3>
        <form class="stack" @submit.prevent="open.run()">
          <div class="field">
            <label for="incoming">Paste the code or link here</label>
            <textarea id="incoming" v-model="incoming" class="input code" rows="3" required />
          </div>
          <button type="submit" class="btn" :disabled="open.busy.value">Open it</button>
        </form>
        <p v-if="imported" class="card" role="status">{{ imported }}</p>
        <p class="hint">Opening the same postcard twice does nothing, and you can’t open one you wrote yourself.</p>
      </section>
    </div>
  </PanelShell>
</template>

<style scoped>
.code { font-family: var(--font-mono, monospace); font-size: 0.8rem; overflow-wrap: anywhere; }
</style>

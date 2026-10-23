<script setup lang="ts">
import { computed, ref } from 'vue'
import { addLoveNote, deleteLoveNote, fetchLoveNotes, type LoveNote } from '@/data/repos/loveUniverse'
import { playSfx } from '@/audio/engine'
import { home, partnerName } from '@/state/household'
import { sendEvent } from '@/state/live'
import { session } from '@/state/session'
import { useAction, useResource } from '@/state/useAsync'

const emit = defineEmits<{ sent: [body: string] }>()

const notes = useResource(fetchLoveNotes, [] as LoveNote[], ['love_notes'])
const body = ref('')
const voice = ref<'love' | 'miss'>('love')
const mine = computed(() => notes.data.value.filter((n) => n.authorId === session.userId))

const sendNow = useAction(async (text: string, kind: 'love' | 'miss') => {
  await sendEvent('love_note', { body: text, voice: kind })
  playSfx('love')
  emit('sent', text)
  body.value = ''
}, { success: 'Sent. If they are offline, it will be waiting for them.' })

const save = useAction(async () => {
  if (!home.household) return
  await addLoveNote(home.household.id, voice.value, body.value)
  body.value = ''
  await notes.reload()
}, { success: 'Saved to your notes for them.' })

const remove = useAction(async (note: LoveNote) => {
  await deleteLoveNote(note.id)
  await notes.reload()
})
</script>

<template>
  <section class="composer" aria-label="Write a note">
    <div class="field">
      <label for="uni-note">A note for {{ partnerName }}</label>
      <textarea id="uni-note" v-model="body" class="input" maxlength="500" rows="3" />
      <span class="hint" aria-live="polite">{{ body.length }} / 500</span>
    </div>
    <div class="row">
      <label class="kind"><input v-model="voice" type="radio" value="love" /> love note</label>
      <label class="kind"><input v-model="voice" type="radio" value="miss" /> miss-you note</label>
    </div>
    <div class="row">
      <button type="button" class="btn btn--small btn--primary" :disabled="!body.trim() || sendNow.busy.value" @click="sendNow.run(body, voice)">Send now</button>
      <button type="button" class="btn btn--small" :disabled="!body.trim() || save.busy.value" @click="save.run()">Keep for when they tap the heart</button>
    </div>
    <details v-if="mine.length > 0">
      <summary>Notes I've written for {{ partnerName }} ({{ mine.length }})</summary>
      <ul class="list" role="list">
        <li v-for="note in mine" :key="note.id" class="row"><span class="grow">{{ note.body }}</span><button type="button" class="btn btn--small btn--quiet" :aria-label="`Delete note: ${note.body.slice(0, 30)}`" @click="remove.run(note)">🗑</button></li>
      </ul>
    </details>
  </section>
</template>

<style scoped>
.composer { display: grid; gap: var(--space-2); text-align: left; }
.kind { display: inline-flex; align-items: center; gap: var(--space-1); font-size: var(--text-sm); }
.list { list-style: none; margin: var(--space-2) 0 0; padding: 0; display: grid; gap: var(--space-1); font-size: var(--text-sm); }
.grow { flex: 1; overflow-wrap: anywhere; }
</style>

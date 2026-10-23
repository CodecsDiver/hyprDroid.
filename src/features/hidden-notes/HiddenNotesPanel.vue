<script setup lang="ts">
import { computed, ref } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import NoteReveal from '@/components/NoteReveal.vue'
import PanelShell from '@/components/PanelShell.vue'
import { deleteNote, placeNote } from '@/data/repos/notes'
import { NOTE_REVEALS, type HiddenNote, type NoteReveal as RevealKind } from '@/domain/notes'
import { relativeTime } from '@/domain/time'
import { getInteraction, noteTargets } from '@/registry/interactionRegistry'
import { partnerName } from '@/state/household'
import { notes, refreshNotes, unreadCounts } from '@/state/notes'
import { session } from '@/state/session'
import { ui } from '@/state/ui'
import { useAction } from '@/state/useAsync'
import type { PanelDefinition } from '../panels'

defineProps<{ definition: PanelDefinition }>()
defineEmits<{ close: [] }>()

const tab = ref<'waiting' | 'place' | 'sent'>(unreadTotal() > 0 ? 'waiting' : 'place')
const targets = noteTargets()
const form = ref({ objectId: ui.objectId && targets.some((t) => t.id === ui.objectId) ? ui.objectId : (targets[0]?.id ?? 'obj_letter_desk'), body: '', openWhen: '', reveal: 'fade' as RevealKind })
const WHEN_SUGGESTIONS = ['you miss me', "you're sad", "you're proud of yourself", "you can't sleep", "you need a laugh"]
const viewing = ref<HiddenNote | null>(null)
// One id per draft: if a submit is retried (network blip) the server de-duplicates it.
let draftId = crypto.randomUUID()

function unreadTotal(): number {
  return [...unreadCounts.value.values()].reduce((sum, n) => sum + n, 0)
}

const waiting = computed(() => notes.value.filter((n) => n.recipientId === session.userId && n.readAt === null).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)))
const opened = computed(() => notes.value.filter((n) => n.recipientId === session.userId && n.readAt !== null))
const sent = computed(() => notes.value.filter((n) => n.authorId === session.userId))
const where = (id: string): string => getInteraction(id)?.label ?? 'the room'

const place = useAction(async () => {
  await placeNote(form.value, draftId)
  draftId = crypto.randomUUID()
  form.value = { ...form.value, body: '', openWhen: '' }
  await refreshNotes()
  tab.value = 'sent'
}, { success: 'Hidden. They will be told something is waiting.' })

const remove = useAction(async (note: HiddenNote) => {
  if (!window.confirm('Take this note back? They will no longer be able to find it.')) return
  await deleteNote(note.id)
  await refreshNotes()
})
</script>

<template>
  <PanelShell :title="definition.title" :icon="definition.icon" @close="$emit('close')">
    <div class="stack">
      <div class="row" role="tablist" aria-label="Notes">
        <button type="button" role="tab" class="btn btn--small" :aria-selected="tab === 'waiting'" :class="{ 'is-active': tab === 'waiting' }" @click="tab = 'waiting'">Waiting ({{ waiting.length }})</button>
        <button type="button" role="tab" class="btn btn--small" :aria-selected="tab === 'place'" :class="{ 'is-active': tab === 'place' }" @click="tab = 'place'">Hide a note</button>
        <button type="button" role="tab" class="btn btn--small" :aria-selected="tab === 'sent'" :class="{ 'is-active': tab === 'sent' }" @click="tab = 'sent'">Hidden by me ({{ sent.length }})</button>
      </div>

      <section v-if="tab === 'waiting'" class="stack" aria-label="Notes waiting for you">
        <EmptyState v-if="waiting.length === 0" emoji="📭" title="Nothing waiting" hint="When someone hides a note for you, an envelope floats over the object it is on." />
        <ul v-else class="plain" role="list">
          <li v-for="note in waiting" :key="note.id" class="card note">
            <div class="grow"><p class="note__where">On the {{ where(note.objectId).toLowerCase() }}</p><p class="hint">{{ note.openWhen ? `Open when ${note.openWhen.toLowerCase()} · ` : '' }}{{ relativeTime(note.createdAt) }}</p></div>
            <button type="button" class="btn btn--primary btn--small" @click="viewing = note">Open</button>
          </li>
        </ul>
        <details v-if="opened.length > 0">
          <summary>Already opened ({{ opened.length }})</summary>
          <ul class="plain" role="list">
            <li v-for="note in opened" :key="note.id" class="card">
              <p class="hint">From the {{ where(note.objectId).toLowerCase() }} · {{ relativeTime(note.createdAt) }}</p>
              <p class="body">{{ note.body }}</p>
            </li>
          </ul>
        </details>
      </section>

      <form v-else-if="tab === 'place'" class="stack" @submit.prevent="place.run()">
        <p class="hint">Hide a private note somewhere in the room. Only {{ partnerName }} will see it, and they'll be told something is waiting even if they're offline.</p>
        <div class="field">
          <label for="where">Hide it on</label>
          <select id="where" v-model="form.objectId" class="input"><option v-for="t in targets" :key="t.id" :value="t.id">{{ t.label }}</option></select>
        </div>
        <div class="field">
          <label for="body">Your note</label>
          <textarea id="body" v-model="form.body" class="input" maxlength="2000" rows="5" required />
          <span class="hint" aria-live="polite">{{ form.body.length }} / 2000</span>
        </div>
        <div class="field">
          <label for="when">Open when… (optional)</label>
          <input id="when" v-model="form.openWhen" class="input" maxlength="60" list="when-list" autocomplete="off" />
          <datalist id="when-list"><option v-for="s in WHEN_SUGGESTIONS" :key="s" :value="s" /></datalist>
        </div>
        <div class="field">
          <label for="reveal">When they find it</label>
          <select id="reveal" v-model="form.reveal" class="input"><option v-for="r in NOTE_REVEALS" :key="r.id" :value="r.id">{{ r.label }}</option></select>
        </div>
        <button type="submit" class="btn btn--primary" :disabled="place.busy.value">Hide note</button>
      </form>

      <section v-else class="stack" aria-label="Notes you hid">
        <EmptyState v-if="sent.length === 0" emoji="🫣" title="You haven't hidden any notes" />
        <ul v-else class="plain" role="list">
          <li v-for="note in sent" :key="note.id" class="card note">
            <div class="grow">
              <p class="note__where">On the {{ where(note.objectId).toLowerCase() }}</p>
              <p class="body">{{ note.body }}</p>
              <p class="hint">{{ note.readAt ? `Opened ${relativeTime(note.readAt)}` : 'Not opened yet' }} · hidden {{ relativeTime(note.createdAt) }}</p>
            </div>
            <button type="button" class="btn btn--small btn--quiet" aria-label="Take this note back" @click="remove.run(note)">🗑</button>
          </li>
        </ul>
      </section>
    </div>
    <NoteReveal v-if="viewing" :note="viewing" :remaining="0" @close="viewing = null" />
  </PanelShell>
</template>

<style scoped>
.plain { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--space-2); }
.note { display: flex; gap: var(--space-2); align-items: flex-start; }
.note__where { margin: 0; font-weight: 700; }
.body { margin: var(--space-1) 0; white-space: pre-wrap; overflow-wrap: anywhere; font-family: var(--font-serif); }
.grow { flex: 1; min-width: 0; }
</style>

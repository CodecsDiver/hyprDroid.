<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import PanelShell from '@/components/PanelShell.vue'
import ResourceView from '@/components/ResourceView.vue'
import { downscaleImage } from '@/data/imageTools'
import { MAX_VOICE_SECONDS, recordingSupported, VoiceRecorder } from '@/data/recorder'
import { addMemory, deleteMemory, fetchMemories, setVisibility, type Memory, type MemoryKind } from '@/data/repos/vault'
import { formatBytes, relativeTime } from '@/domain/time'
import { myName, partnerName } from '@/state/household'
import { session } from '@/state/session'
import { useAction, useResource } from '@/state/useAsync'
import type { PanelDefinition } from '../panels'
import VaultMedia from './VaultMedia.vue'

defineProps<{ definition: PanelDefinition }>()
defineEmits<{ close: [] }>()

const memories = useResource(fetchMemories, [] as Memory[], ['memories'])
const filter = ref<'all' | MemoryKind>('all')
const adding = ref(false)
const form = ref({ kind: 'note' as MemoryKind, title: '', body: '', occurredOn: '', visibility: 'shared' as 'shared' | 'private' })
const file = ref<Blob | null>(null)
const fileLabel = ref('')

const KINDS: { id: MemoryKind; label: string; emoji: string }[] = [
  { id: 'note', label: 'Note', emoji: '📝' }, { id: 'photo', label: 'Photo', emoji: '📷' },
  { id: 'voice', label: 'Voice', emoji: '🎙' }, { id: 'milestone', label: 'Milestone', emoji: '⭐' },
]
const kindInfo = (kind: MemoryKind) => KINDS.find((k) => k.id === kind)!

const shown = computed(() => memories.data.value.filter((m) => filter.value === 'all' || m.kind === filter.value))
const authorName = (id: string): string => (id === session.userId ? myName.value : partnerName.value)

// ----------------------------------------------------------- photo
async function onPhoto(event: Event): Promise<void> {
  const chosen = (event.target as HTMLInputElement).files?.[0]
  if (!chosen) return
  try {
    file.value = await downscaleImage(chosen, 2048, 0.86) // also strips location/EXIF metadata
    fileLabel.value = `${chosen.name} → ${formatBytes(file.value.size)}`
  } catch {
    file.value = null
    fileLabel.value = ''
    alert('That image could not be read. Try a JPEG, PNG or WebP photo.')
  }
}

// ----------------------------------------------------------- voice
const recorder = new VoiceRecorder()
const recording = ref(false)
const seconds = ref(0)
let ticker: ReturnType<typeof setInterval> | null = null
const voiceUrl = ref<string | null>(null)

async function startRecording(): Promise<void> {
  try {
    await recorder.start(() => void finishRecording())
    recording.value = true
    seconds.value = 0
    ticker = setInterval(() => (seconds.value = Math.round((Date.now() - recorder.startedAt) / 1000)), 500)
  } catch {
    alert('The microphone is not available. Check that you allowed access for this site.')
  }
}
async function finishRecording(): Promise<void> {
  if (!recording.value) return
  recording.value = false
  if (ticker) clearInterval(ticker)
  const blob = await recorder.stop()
  file.value = blob
  fileLabel.value = `Recording · ${formatBytes(blob.size)}`
  if (voiceUrl.value) URL.revokeObjectURL(voiceUrl.value)
  voiceUrl.value = URL.createObjectURL(blob)
}
onBeforeUnmount(() => {
  recorder.cancel()
  if (ticker) clearInterval(ticker)
  if (voiceUrl.value) URL.revokeObjectURL(voiceUrl.value)
})

function resetForm(): void {
  form.value = { kind: 'note', title: '', body: '', occurredOn: '', visibility: 'shared' }
  file.value = null
  fileLabel.value = ''
  if (voiceUrl.value) URL.revokeObjectURL(voiceUrl.value)
  voiceUrl.value = null
}

const save = useAction(async () => {
  await addMemory({ ...form.value, file: file.value })
  resetForm()
  adding.value = false
  await memories.reload()
}, { success: 'Saved to the vault.' })

const toggleVisibility = useAction(async (memory: Memory) => {
  await setVisibility(memory.id, memory.visibility === 'shared' ? 'private' : 'shared')
  await memories.reload()
})
const remove = useAction(async (memory: Memory) => {
  if (!window.confirm(`Delete “${memory.title}” forever?`)) return
  await deleteMemory(memory)
  await memories.reload()
})
</script>

<template>
  <PanelShell :title="definition.title" :icon="definition.icon" @close="$emit('close')">
    <div class="stack">
      <div class="row">
        <button v-for="f in (['all', ...KINDS.map((k) => k.id)] as const)" :key="f" type="button" class="btn btn--small" :aria-pressed="filter === f" @click="filter = f">{{ f === 'all' ? 'All' : kindInfo(f).label }}</button>
        <button type="button" class="btn btn--small btn--primary push" :aria-expanded="adding" @click="adding = !adding">{{ adding ? 'Close' : '＋ Add memory' }}</button>
      </div>

      <form v-if="adding" class="card stack" @submit.prevent="save.run()">
        <fieldset class="kinds"><legend class="visually-hidden">What kind of memory?</legend>
          <label v-for="k in KINDS" :key="k.id" class="kind" :class="{ 'kind--on': form.kind === k.id }">
            <input v-model="form.kind" class="visually-hidden" type="radio" name="kind" :value="k.id" @change="file = null; fileLabel = ''" />{{ k.emoji }} {{ k.label }}
          </label>
        </fieldset>
        <div class="field"><label for="m-title">Title</label><input id="m-title" v-model="form.title" class="input" maxlength="120" required /></div>
        <div v-if="form.kind === 'photo'" class="field">
          <label for="m-photo">Photo</label><input id="m-photo" type="file" accept="image/*" required @change="onPhoto" />
          <span class="hint">Photos are resized and stripped of location data before upload. {{ fileLabel }}</span>
        </div>
        <div v-if="form.kind === 'voice'" class="stack">
          <p v-if="!recordingSupported()" class="error-text" role="alert">Recording isn't supported in this browser.</p>
          <template v-else>
            <div class="row">
              <button v-if="!recording" type="button" class="btn btn--small" @click="startRecording">● Record</button>
              <button v-else type="button" class="btn btn--small btn--danger" @click="finishRecording">■ Stop ({{ seconds }}s)</button>
              <span class="hint" role="status">{{ recording ? `Recording… up to ${MAX_VOICE_SECONDS / 60} minutes` : fileLabel }}</span>
            </div>
            <audio v-if="voiceUrl" :src="voiceUrl" controls aria-label="Preview your recording" />
          </template>
        </div>
        <div v-if="form.kind === 'note' || form.kind === 'milestone'" class="field"><label for="m-body">{{ form.kind === 'note' ? 'Note' : 'What happened?' }}</label><textarea id="m-body" v-model="form.body" class="input" maxlength="5000" rows="5" required /></div>
        <div v-else class="field"><label for="m-body2">Caption (optional)</label><input id="m-body2" v-model="form.body" class="input" maxlength="5000" /></div>
        <div class="field"><label for="m-date">When was it? (optional)</label><input id="m-date" v-model="form.occurredOn" class="input" type="date" /></div>
        <label class="switch"><input v-model="form.visibility" type="checkbox" true-value="private" false-value="shared" /><span>Keep this private — only I can see it</span></label>
        <button type="submit" class="btn btn--primary" :disabled="save.busy.value || (['photo', 'voice'].includes(form.kind) && !file)">{{ save.busy.value ? 'Saving…' : 'Save to the vault' }}</button>
      </form>

      <ResourceView :loading="memories.loading.value" :error="memories.error.value" @retry="memories.reload">
        <EmptyState v-if="shown.length === 0" emoji="📷" title="Nothing here yet" hint="Photos, voice messages, notes and milestones you want to keep." />
        <ul v-else class="plain" role="list">
          <li v-for="memory in shown" :key="memory.id" class="card stack">
            <div class="head">
              <h4>{{ kindInfo(memory.kind).emoji }} {{ memory.title }}</h4>
              <span v-if="memory.visibility === 'private'" class="chip">🔒 private</span>
            </div>
            <VaultMedia v-if="memory.fileId" :memory="memory" />
            <p v-if="memory.body" class="body">{{ memory.body }}</p>
            <p class="hint">{{ authorName(memory.authorId) }} · {{ memory.occurredOn ?? relativeTime(memory.createdAt) }}</p>
            <div v-if="memory.authorId === session.userId" class="row">
              <button type="button" class="btn btn--small btn--quiet" @click="toggleVisibility.run(memory)">{{ memory.visibility === 'shared' ? 'Make private' : 'Share with ' + partnerName }}</button>
              <button type="button" class="btn btn--small btn--quiet" :aria-label="`Delete ${memory.title}`" @click="remove.run(memory)">🗑 Delete</button>
            </div>
          </li>
        </ul>
      </ResourceView>
    </div>
  </PanelShell>
</template>

<style scoped>
.push { margin-left: auto; }
.plain { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--space-3); }
.head { display: flex; justify-content: space-between; gap: var(--space-2); align-items: baseline; }
.head h4 { overflow-wrap: anywhere; }
.body { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-family: var(--font-serif); }
.kinds { border: 0; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-2); }
.kind { display: flex; align-items: center; justify-content: center; gap: var(--space-2); min-height: var(--tap-target); border: 1px solid var(--line-soft); border-radius: var(--radius-md); cursor: pointer; }
.kind--on { border-color: var(--color-gold); background: color-mix(in srgb, var(--color-gold) 18%, transparent); }
.kind:focus-within { box-shadow: var(--focus-ring); }
.switch { display: flex; gap: var(--space-3); align-items: center; min-height: var(--tap-target); font-size: var(--text-sm); }
.switch input { width: 22px; height: 22px; accent-color: var(--color-gold); flex: none; }
</style>

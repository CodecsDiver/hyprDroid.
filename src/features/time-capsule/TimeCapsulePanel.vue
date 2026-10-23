<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import PanelShell from '@/components/PanelShell.vue'
import ResourceView from '@/components/ResourceView.vue'
import { buildLoadMessage, isViewerReady, VIEWER_DOCUMENT, VIEWER_SANDBOX, verifyArchive } from '@/capsule/integrity'
import { fetchCapsuleItems, type CapsuleItem } from '@/data/repos/capsule'
import { downloadFile } from '@/data/files'
import { formatBytes } from '@/domain/time'
import { useAction, useResource } from '@/state/useAsync'
import type { PanelDefinition } from '../panels'

defineProps<{ definition: PanelDefinition }>()
defineEmits<{ close: [] }>()

const items = useResource(fetchCapsuleItems, [] as CapsuleItem[])
const opened = ref<CapsuleItem | null>(null)
const status = ref<'idle' | 'verifying' | 'ok' | 'failed'>('idle')
const frame = ref<HTMLIFrameElement | null>(null)
const allowInternet = ref(false)
let html = ''

function onMessage(event: MessageEvent): void {
  // Only the viewer iframe we created may talk to us.
  if (event.source !== frame.value?.contentWindow || !opened.value) return
  if (isViewerReady(event.data)) frame.value?.contentWindow?.postMessage(buildLoadMessage(html, opened.value.title, allowInternet.value), '*')
}
window.addEventListener('message', onMessage)
onBeforeUnmount(() => window.removeEventListener('message', onMessage))

const open = useAction(async (item: CapsuleItem) => {
  status.value = 'verifying'
  const bytes = await downloadFile(item.fileId)
  const result = await verifyArchive(bytes, item.sha256)
  if (!result.ok) {
    status.value = 'failed'
    throw new Error('The archived file does not match its recorded fingerprint, so it was not opened.')
  }
  html = new TextDecoder('utf-8').decode(bytes)
  status.value = 'ok'
  opened.value = item
})

function close(): void {
  opened.value = null
  html = ''
  status.value = 'idle'
}
</script>

<template>
  <PanelShell :title="opened ? opened.title : definition.title" :icon="definition.icon" fullscreen @close="opened ? close() : $emit('close')">
    <div v-if="opened" class="viewer">
      <div class="viewer__bar">
        <button type="button" class="btn btn--small" @click="close">← Back to the capsule</button>
        <span class="chip" role="status">✓ Verified: identical to what was archived</span>
      </div>
      <p class="hint viewer__note">
        This is the original page, shown exactly as it was saved. It runs in an isolated sandbox with no access to this app or your account. Anything it
        used to load from the internet (fonts, a 3D library, sound loops, models) is blocked, so parts of it may look plainer than they once did.
      </p>
      <iframe ref="frame" class="viewer__frame" :title="`${opened.title} (archived original)`" :srcdoc="VIEWER_DOCUMENT" :sandbox="VIEWER_SANDBOX" referrerpolicy="no-referrer" allow="autoplay" />
    </div>

    <div v-else class="stack">
      <label class="switch"><input v-model="allowInternet" type="checkbox" /><span>Let the originals load their fonts and 3D library from the internet, as they were built to. Off by default: nothing leaves this browser.</span></label>
      <p>Two earlier versions of this home, kept exactly as they were. They're a keepsake: nothing in them is edited, and they're separate from the rebuilt app.</p>
      <ResourceView :loading="items.loading.value" :error="items.error.value" @retry="items.reload">
        <EmptyState v-if="items.data.value.length === 0" emoji="⏳" title="The capsule is empty" hint="The original apps are only included in your private build (see the README, “Your private copy”)." />
        <ul v-else class="plain" role="list">
          <li v-for="item in items.data.value" :key="item.id" class="card stack">
            <h3>{{ item.title }}</h3>
            <p v-if="item.description" class="hint">{{ item.description }}</p>
            <p class="hint">Archived {{ new Date(item.archivedAt).toLocaleDateString() }} · {{ formatBytes(item.byteSize) }}</p>
            <p class="hint fingerprint">SHA-256 <code>{{ item.sha256.slice(0, 16) }}…</code></p>
            <button type="button" class="btn btn--primary" :disabled="open.busy.value" @click="open.run(item)">{{ status === 'verifying' ? 'Checking…' : 'Open the original' }}</button>
          </li>
        </ul>
        <p v-if="status === 'failed'" class="error-text" role="alert">Integrity check failed — the file was not opened.</p>
      </ResourceView>
    </div>
  </PanelShell>
</template>

<style scoped>
.switch { display: flex; gap: var(--space-3); align-items: flex-start; font-size: var(--text-sm); min-height: var(--tap-target); }
.switch input { width: 22px; height: 22px; margin-top: 2px; accent-color: var(--color-gold); flex: none; }
.plain { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--space-3); }
.fingerprint code { background: var(--surface-glass); padding: 0 6px; border-radius: 6px; }
.viewer { display: grid; grid-template-rows: auto auto 1fr; gap: var(--space-2); height: calc(100dvh - 120px); }
.viewer__bar { display: flex; gap: var(--space-2); align-items: center; justify-content: space-between; flex-wrap: wrap; }
.viewer__note { margin: 0; }
.viewer__frame { width: 100%; height: 100%; min-height: 300px; border: 1px solid var(--line-soft); border-radius: var(--radius-md); background: #080008; }
</style>

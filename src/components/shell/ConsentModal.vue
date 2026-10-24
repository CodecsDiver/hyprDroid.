<script setup lang="ts">
import { useWorkspaceStore } from '../../stores/workspaceStore'

const workspace = useWorkspaceStore()
</script>

<template>
  <div v-if="workspace.consentRequest" class="scrim" role="dialog" aria-modal="true">
    <div class="dialog panel">
      <div class="panel-title">No sandbox available</div>
      <div class="content">
        <p>
          Python Discovery normally runs your code inside <b>bubblewrap</b> (no network, read-only system, only your
          project folder writable). It is not usable on this machine.
        </p>
        <p class="warn">
          Running without it gives your code the <b>full access of your user account</b>. This is not a security
          boundary. Only continue if you trust the code you wrote.
        </p>
        <p class="mono-dim">Install the sandbox: <code>sudo apt install bubblewrap</code></p>
        <div class="actions">
          <button class="btn is-ghost" @click="workspace.answerConsent(false)">Cancel</button>
          <button class="btn is-amber" @click="workspace.answerConsent(true)">Run without sandbox</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrim { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; background: rgb(var(--void-rgb) / 0.8); }
.dialog { width: 520px; background: var(--hull-raised); }
.content { padding: 16px 20px 20px; line-height: 1.6; }
.content p { margin: 0 0 12px; }
.warn { color: var(--neon-amber); }
code { padding: 1px 6px; background: rgb(var(--neon-cyan-rgb) / 0.12); color: var(--neon-cyan); user-select: text; -webkit-user-select: text; }
.actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 18px; }
</style>

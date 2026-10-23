<script setup lang="ts">
import { ref } from 'vue'
import { invitePartner } from '@/data/repos/household'
import { home } from '@/state/household'
import { showToast } from '@/state/toasts'
import { useAction } from '@/state/useAsync'

const email = ref('')
const token = ref<string | null>(null)

const create = useAction(async () => {
  token.value = await invitePartner(email.value)
})

async function copy(): Promise<void> {
  if (!token.value) return
  try {
    await navigator.clipboard.writeText(token.value)
    showToast('Invite code copied.', { tone: 'success' })
  } catch {
    showToast('Could not copy — select the code and copy it manually.', { tone: 'warning' })
  }
}
</script>

<template>
  <section class="stack" aria-labelledby="invite-h">
    <h3 id="invite-h">Invite your partner</h3>
    <p class="hint">
      Enter the email address your partner signs in with. The invite works once, only for that address, and expires in 7 days.
      Send the code to them privately.
    </p>
    <p v-if="home.pendingInvite && !token" class="hint" role="status">
      An invite for {{ home.pendingInvite.email }} is pending. Creating a new one replaces it.
    </p>
    <form class="stack" @submit.prevent="create.run()">
      <div class="field">
        <label for="partner-email">Partner's email</label>
        <input id="partner-email" v-model="email" class="input" type="email" autocomplete="off" inputmode="email" required />
      </div>
      <button type="submit" class="btn btn--primary" :disabled="create.busy.value">Create invite code</button>
    </form>
    <div v-if="token" class="card stack" role="status">
      <p class="hint">Invite code (shown once — it is not stored anywhere readable):</p>
      <code class="token">{{ token }}</code>
      <button type="button" class="btn btn--small" @click="copy">Copy code</button>
    </div>
  </section>
</template>

<style scoped>
.token { word-break: break-all; font-size: var(--text-sm); background: var(--surface-glass); padding: var(--space-2); border-radius: var(--radius-sm); user-select: all; }
</style>

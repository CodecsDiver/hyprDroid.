<script setup lang="ts">
import { ref } from 'vue'
import InvitePartner from '@/components/InvitePartner.vue'
import { acceptInvite, createHousehold } from '@/data/repos/household'
import { home, loadHome } from '@/state/household'
import { session, signOut } from '@/state/session'
import { useAction } from '@/state/useAsync'

const mode = ref<'create' | 'join'>('create')
const householdName = ref('Our Home')
const displayName = ref(home.me?.displayName ?? '')
const token = ref('')

async function refresh(): Promise<void> {
  if (session.userId) await loadHome(session.userId)
}

const create = useAction(async () => {
  await createHousehold(householdName.value, displayName.value)
  await refresh()
})
const join = useAction(async () => {
  await acceptInvite(token.value)
  await refresh()
})
</script>

<template>
  <main class="setup">
    <h1>Welcome home</h1>
    <p class="hint">This is a household for exactly two people. One of you creates it and invites the other.</p>

    <div class="row" role="tablist" aria-label="Setup choice">
      <button type="button" role="tab" class="btn" :aria-selected="mode === 'create'" :class="{ 'is-active': mode === 'create' }" @click="mode = 'create'">Create our home</button>
      <button type="button" role="tab" class="btn" :aria-selected="mode === 'join'" :class="{ 'is-active': mode === 'join' }" @click="mode = 'join'">I have an invite code</button>
    </div>

    <form v-if="mode === 'create'" class="stack setup__form" @submit.prevent="create.run()">
      <div class="field">
        <label for="your-name">Your name</label>
        <input id="your-name" v-model="displayName" class="input" maxlength="40" autocomplete="given-name" required />
      </div>
      <div class="field">
        <label for="home-name">Name of your home</label>
        <input id="home-name" v-model="householdName" class="input" maxlength="60" required />
      </div>
      <button type="submit" class="btn btn--primary" :disabled="create.busy.value">Create home</button>
      <InvitePartner v-if="home.status === 'ready'" />
    </form>

    <form v-else class="stack setup__form" @submit.prevent="join.run()">
      <div class="field">
        <label for="token">Invite code</label>
        <input id="token" v-model="token" class="input" autocomplete="off" spellcheck="false" required />
        <span class="hint">You must be signed in with the email address the invite was made for.</span>
      </div>
      <button type="submit" class="btn btn--primary" :disabled="join.busy.value">Join home</button>
    </form>

    <button type="button" class="btn btn--small btn--quiet" @click="signOut()">Sign out</button>
  </main>
</template>

<style scoped>
.setup { height: 100%; overflow-y: auto; display: grid; align-content: center; justify-items: center; gap: var(--space-3); padding: calc(var(--safe-top) + var(--space-5)) var(--gutter) calc(var(--safe-bottom) + var(--space-5)); text-align: center; }
.setup__form { width: min(400px, 100%); text-align: left; }
</style>

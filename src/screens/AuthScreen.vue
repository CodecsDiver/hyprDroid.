<script setup lang="ts">
import { ref } from 'vue'
import { useManifestImage } from '@/state/assets'
import { sendMagicLink, signInWithPassword } from '@/state/session'
import { useAction } from '@/state/useAsync'

const email = ref('')
const password = ref('')
const linkSent = ref(false)
const logo = useManifestImage('logo')

const signIn = useAction(async () => {
  await signInWithPassword(email.value, password.value)
})
const link = useAction(async () => {
  if (!email.value.trim()) throw Object.assign(new Error('Enter your email first.'), { name: 'ValidationError' })
  await sendMagicLink(email.value)
  linkSent.value = true
})
</script>

<template>
  <main class="auth">
    <img v-if="logo.url.value" class="auth__logo" :src="logo.url.value" :alt="logo.alt.value" width="96" height="96" />
    <div v-else class="auth__heart" aria-hidden="true">♥</div>
    <h1>Signal Home</h1>
    <p class="hint auth__sub">A private home for two. Sign in to come inside.</p>

    <form class="stack auth__form" @submit.prevent="signIn.run()">
      <div class="field">
        <label for="email">Email</label>
        <input id="email" v-model="email" class="input" type="email" autocomplete="email" required inputmode="email" />
      </div>
      <div class="field">
        <label for="password">Password</label>
        <input id="password" v-model="password" class="input" type="password" autocomplete="current-password" required />
      </div>
      <button type="submit" class="btn btn--primary" :disabled="signIn.busy.value">{{ signIn.busy.value ? 'Signing in…' : 'Sign in' }}</button>
      <button type="button" class="btn btn--quiet" :disabled="link.busy.value" @click="link.run()">Email me a sign-in link instead</button>
      <p v-if="linkSent" class="hint" role="status">If that address belongs to an account, a sign-in link is on its way.</p>
    </form>
    <p class="hint">Accounts are created by invitation only.</p>
  </main>
</template>

<style scoped>
.auth { height: 100%; overflow-y: auto; display: grid; align-content: center; justify-items: center; gap: var(--space-2); padding: calc(var(--safe-top) + var(--space-5)) var(--gutter) calc(var(--safe-bottom) + var(--space-5)); text-align: center; }
.auth__heart { font-size: 3rem; color: var(--color-rose); filter: drop-shadow(0 0 18px rgba(255, 122, 170, 0.6)); }
.auth__logo { width: 96px; height: 96px; object-fit: contain; }
.auth__sub { margin: 0 0 var(--space-3); }
.auth__form { width: min(380px, 100%); text-align: left; }
</style>

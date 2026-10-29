<script setup lang="ts">
import { firstRunProblem, storageIsPersistent, PEOPLE } from '@/local/backend'
import { useManifestImage } from '@/state/assets'
import { prefs } from '@/state/prefs'
import { chooseWhoIsHere } from '@/state/session'
import { useAction } from '@/state/useAsync'

const logo = useManifestImage('logo')
const choose = useAction(async (id: (typeof PEOPLE)[number]['id']) => {
  await chooseWhoIsHere(id)
})
</script>

<template>
  <main class="auth">
    <img v-if="logo.url.value" class="auth__logo" :src="logo.url.value" :alt="logo.alt.value" width="96" height="96" />
    <div v-else class="auth__heart" aria-hidden="true">♥</div>
    <h1>Signal Home</h1>
    <p class="hint auth__sub">A private home for two. Who is here?</p>

    <div class="stack auth__form">
      <button v-for="person in PEOPLE" :key="person.id" type="button" class="btn btn--primary" :disabled="choose.busy.value" @click="choose.run(person.id)">I’m {{ person.name }}</button>
    </div>
    <p v-if="prefs.entranceOn && prefs.entranceUrl" class="hint">🎵 Your album starts when you come in.</p>
    <p class="hint">Everything lives only in this browser. There are no accounts, and nothing is sent anywhere.</p>
    <p v-if="firstRunProblem()" class="hint" role="alert">Your original files could not be loaded ({{ firstRunProblem() }}). Everything else works.</p>
    <p v-if="!storageIsPersistent()" class="hint" role="status">This browser would not give the page any storage (a private window?), so everything will be forgotten when you close it.</p>
  </main>
</template>

<style scoped>
.auth { height: 100%; overflow-y: auto; display: grid; align-content: center; justify-items: center; gap: var(--space-2); padding: calc(var(--safe-top) + var(--space-5)) var(--gutter) calc(var(--safe-bottom) + var(--space-5)); text-align: center; }
.auth__heart { font-size: 3rem; color: var(--color-rose); filter: drop-shadow(0 0 18px rgba(255, 122, 170, 0.6)); }
.auth__logo { width: 96px; height: 96px; object-fit: contain; }
.auth__sub { margin: 0 0 var(--space-3); }
.auth__form { width: min(380px, 100%); text-align: left; }
</style>

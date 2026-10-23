<script setup lang="ts">
defineProps<{ problems: string[] }>()
</script>

<template>
  <main class="center">
    <h1>Signal Home is not set up yet</h1>
    <p>The app is deployed, but the server has no people or secrets configured. This is expected on a first deploy.</p>
    <ul v-if="problems.length > 0" class="problems" role="list">
      <li v-for="problem in problems" :key="problem">{{ problem }}</li>
    </ul>
    <ol class="steps">
      <li>Run <code>npm run setup:auth</code> on your computer. It asks for two names and passwords and prints three values.</li>
      <li>In Netlify: Site configuration → Environment variables. Add <code>SIGNAL_USERS</code>, <code>SIGNAL_SESSION_SECRET</code> and <code>SIGNAL_ADMIN_TOKEN</code>.</li>
      <li>Trigger a new deploy. Details are in <code>docs/SETUP.md</code>.</li>
    </ol>
  </main>
</template>

<style scoped>
.center { height: 100%; overflow-y: auto; display: grid; align-content: center; justify-items: center; gap: var(--space-3); padding: calc(var(--safe-top) + var(--space-5)) var(--gutter); text-align: center; }
.problems { list-style: none; padding: 0; margin: 0; color: var(--color-danger); }
.steps { text-align: left; max-width: 34rem; color: var(--color-ink-muted); }
code { background: var(--surface-glass); padding: 1px 6px; border-radius: 6px; }
</style>

<script setup lang="ts">
defineProps<{ problems: string[] }>()
</script>

<template>
  <main class="center">
    <h1>Signal Home needs a backend</h1>
    <p>The app is built, but it is not connected to a Supabase project yet. This is expected on a first run.</p>
    <ul class="problems" role="list">
      <li v-for="problem in problems" :key="problem">{{ problem }}</li>
    </ul>
    <ol class="steps">
      <li>Create a Supabase project and run the SQL files in <code>supabase/migrations</code>, in order.</li>
      <li>Disable public sign-ups and create the two accounts (Authentication → Users).</li>
      <li>Copy <code>.env.example</code> to <code>.env.local</code> and set the project URL and the <strong>anon</strong> key.</li>
      <li>Restart the dev server. Full instructions are in <code>docs/SETUP.md</code>.</li>
    </ol>
  </main>
</template>

<style scoped>
.center { height: 100%; overflow-y: auto; display: grid; align-content: center; justify-items: center; gap: var(--space-3); padding: calc(var(--safe-top) + var(--space-5)) var(--gutter); text-align: center; }
.problems { list-style: none; padding: 0; margin: 0; color: var(--color-danger); }
.steps { text-align: left; max-width: 34rem; color: var(--color-ink-muted); }
code { background: var(--surface-glass); padding: 1px 6px; border-radius: 6px; }
</style>

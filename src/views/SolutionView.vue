<script setup lang="ts">
import { computed, onMounted } from 'vue'
import CodeEditor from '../components/editor/CodeEditor.vue'
import TitleBar from '../components/shell/TitleBar.vue'
import { findProject } from '../curriculum/projects'
import { REFERENCE_SOLUTIONS, SOLUTION_EXAMPLES } from '../curriculum/referenceSolutions'
import { usePracticeStore } from '../stores/practiceStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useThemeStore } from '../stores/themeStore'

const practice = usePracticeStore()
const settings = useSettingsStore()
const theme = useThemeStore()

const project = computed(() => (practice.solutionView ? findProject(practice.solutionView) : undefined))
const solution = computed(() => (project.value ? (REFERENCE_SOLUTIONS[project.value.id] ?? '').trim() + '\n' : ''))
const examples = computed(() => (project.value ? (SOLUTION_EXAMPLES[project.value.id] ?? []) : []))
const lineCount = computed(() => solution.value.split('\n').length - 1)

onMounted(async () => {
  await settings.load()
  await theme.load()
  await practice.load()
})
</script>

<template>
  <div class="solution">
    <div class="realm-backdrop" />
    <TitleBar data-theme-part="titlebar" title="Solution" subtitle="// read it, understand it, then type it yourself" />
    <div v-if="!project" class="empty">Nothing to show yet. Fail three checks on a mission, or clear it, and its solution opens here.</div>
    <main v-else class="body">
      <section class="panel intro">
        <div class="panel-title">{{ project.title }}</div>
        <div class="content">
          <p>{{ project.summary }}</p>
          <p class="dim">
            Every function, variable and block below is commented with what it does, why it is written that way, and how it works.
            Nothing here is pasted for you: type it into your own file and press Check my work.
          </p>
          <ul class="examples">
            <li v-for="example in examples" :key="example"><code>{{ example }}</code></li>
          </ul>
        </div>
      </section>
      <section class="panel code">
        <div class="panel-title">Full solution &middot; {{ lineCount }} lines</div>
        <div class="editor-slot">
          <CodeEditor :key="project.id" :model-value="solution" read-only :effects="false" :font-size="Math.min(settings.editorFontSize, 17)" />
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.solution { position: relative; display: flex; flex-direction: column; height: 100%; }
.body { position: relative; z-index: 1; flex: 1; min-height: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 12px; padding: 12px; }
.empty { position: relative; z-index: 1; display: grid; place-items: center; flex: 1; padding: 24px; text-align: center; color: var(--text-dim); }
.content { padding: 10px 16px 14px; font-size: 13px; line-height: 1.55; user-select: text; -webkit-user-select: text; }
.content p { margin: 6px 0; }
.dim { color: var(--text-dim); font-size: 12px; }
.examples { margin: 8px 0 0; padding: 0; list-style: none; display: grid; gap: 4px; }
.examples code { color: var(--neon-green); font-size: 12px; }
.code { display: flex; flex-direction: column; min-height: 0; background: rgb(var(--editor-bg-rgb) / 0.88); }
.editor-slot { flex: 1; min-height: 0; position: relative; }
</style>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { loadDocument } from '../backend/backend'
import { publishLessonStudied } from '../backend/crossWindow'
import TitleBar from '../components/shell/TitleBar.vue'
import { XP_REWARDS } from '../gamification/progressionEngine'
import type { ProgressionState } from '../gamification/types'
import { LESSONS } from '../lessons/catalog'
import { useSettingsStore } from '../stores/settingsStore'

const settings = useSettingsStore()

const selectedLessonId = ref(LESSONS[0].id)
const studiedLessonIds = ref<string[]>([])
const justStudiedId = ref<string | null>(null)
const copyFeedback = ref('')

const selectedLesson = computed(() => LESSONS.find((lesson) => lesson.id === selectedLessonId.value) ?? LESSONS[0])

async function refreshStudied(): Promise<void> {
  try {
    const stored = await loadDocument<Partial<ProgressionState>>('progression')
    const fromDisk = stored?.studiedLessonIds ?? []
    studiedLessonIds.value = [...new Set([...studiedLessonIds.value, ...fromDisk])]
  } catch {
    // The lab still works without the saved list; check marks just start empty.
  }
}

async function handleStudied(): Promise<void> {
  const lessonId = selectedLessonId.value
  if (studiedLessonIds.value.includes(lessonId)) return
  studiedLessonIds.value = [...studiedLessonIds.value, lessonId]
  justStudiedId.value = lessonId
  setTimeout(() => {
    if (justStudiedId.value === lessonId) justStudiedId.value = null
  }, 4500)
  await publishLessonStudied(lessonId)
}

async function copySnippet(): Promise<void> {
  try {
    await navigator.clipboard.writeText(selectedLesson.value.pythonSnippet)
    copyFeedback.value = 'Copied. Paste it in the editor and type your own version.'
  } catch {
    copyFeedback.value = 'Clipboard unavailable: select the code and copy it manually.'
  }
  setTimeout(() => (copyFeedback.value = ''), 3000)
}

onMounted(async () => {
  await settings.load()
  await refreshStudied()
  window.addEventListener('focus', refreshStudied)
})
onBeforeUnmount(() => window.removeEventListener('focus', refreshStudied))
</script>

<template>
  <div class="lab">
    <div class="realm-backdrop" />
    <TitleBar title="Lesson Lab" subtitle="// interactive visualizers" />

    <div class="body">
      <nav class="catalog panel">
        <div class="panel-title">Visualizers</div>
        <ul>
          <li
            v-for="lesson in LESSONS"
            :key="lesson.id"
            :class="{ selected: lesson.id === selectedLessonId, studied: studiedLessonIds.includes(lesson.id) }"
            @click="selectedLessonId = lesson.id"
          >
            <span class="mark">{{ studiedLessonIds.includes(lesson.id) ? '✓' : '◇' }}</span>
            <span class="text">
              <span class="title">{{ lesson.title }}</span>
              <span class="tagline">{{ lesson.tagline }}</span>
            </span>
          </li>
        </ul>
        <div class="progress">{{ studiedLessonIds.length }} / {{ LESSONS.length }} studied</div>
      </nav>

      <main class="lesson panel">
        <div class="panel-title">{{ selectedLesson.title }}</div>
        <div class="scroll">
          <section class="explain">
            <p v-for="(paragraph, index) in selectedLesson.paragraphs" :key="index">{{ paragraph }}</p>
            <div class="goal" :class="{ done: studiedLessonIds.includes(selectedLesson.id) }">
              <b>STUDY GOAL</b> {{ selectedLesson.studyGoal }}
              <span class="reward">+{{ XP_REWARDS.lessonStudied }} XP</span>
            </div>
            <Transition name="stamp">
              <div v-if="justStudiedId === selectedLesson.id" class="studied-stamp">
                LESSON STUDIED &mdash; XP is credited in the main Python Discovery window
              </div>
            </Transition>
          </section>

          <section class="stage">
            <component :is="selectedLesson.visualizer" :key="selectedLesson.id" @studied="handleStudied" />
          </section>

          <section class="snippet">
            <div class="snippet-head">
              <span>PYTHON</span>
              <button class="btn is-ghost" @click="copySnippet">Copy</button>
            </div>
            <pre>{{ selectedLesson.pythonSnippet }}</pre>
            <div class="feedback">{{ copyFeedback }}</div>
          </section>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.lab { position: relative; display: flex; flex-direction: column; height: 100%; }
.body { position: relative; z-index: 1; flex: 1; min-height: 0; display: grid; grid-template-columns: 290px 1fr; gap: 12px; padding: 12px; }
.catalog { display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
.catalog ul { list-style: none; margin: 0; padding: 8px; flex: 1; overflow: auto; display: flex; flex-direction: column; gap: 6px; }
.catalog li { display: flex; gap: 10px; padding: 10px 12px; cursor: pointer; border-left: 3px solid rgba(113, 134, 160, 0.35); background: rgba(255, 255, 255, 0.02); transition: background 0.15s, transform 0.15s, border-color 0.15s; }
.catalog li:hover { background: rgba(25, 230, 255, 0.07); transform: translateX(3px); }
.catalog li.selected { border-left-color: var(--neon-violet); background: linear-gradient(90deg, rgba(164, 92, 255, 0.2), transparent); }
.mark { color: var(--neon-amber); }
.studied .mark { color: var(--neon-green); text-shadow: var(--glow-green); }
.text { display: flex; flex-direction: column; }
.title { font-weight: 700; }
.tagline { font-size: 11px; color: var(--text-dim); }
.progress { padding: 10px 14px; border-top: 1px solid rgba(25, 230, 255, 0.16); font-size: 11px; letter-spacing: 0.15em; color: var(--neon-cyan); }

.lesson { display: flex; flex-direction: column; min-height: 0; overflow: hidden; background: rgba(6, 9, 18, 0.88); }
.scroll { flex: 1; overflow: auto; padding: 18px 24px 28px; display: flex; flex-direction: column; gap: 20px; }
.explain p { margin: 0 0 10px; max-width: 78ch; line-height: 1.65; color: var(--text); font-size: 14px; user-select: text; -webkit-user-select: text; }
.goal { display: flex; align-items: center; gap: 12px; padding: 9px 14px; border: 1px dashed var(--neon-amber); color: var(--neon-amber); }
.goal.done { border-color: var(--neon-green); color: var(--neon-green); }
.goal b { letter-spacing: 0.2em; font-size: 10px; }
.reward { margin-left: auto; font-weight: 700; }
.studied-stamp { margin-top: 10px; padding: 10px 14px; color: var(--void); background: var(--neon-green); box-shadow: var(--glow-green); font-weight: 700; letter-spacing: 0.08em; }
.stamp-enter-active { animation: stamp-in 0.5s cubic-bezier(0.2, 1.6, 0.3, 1); }
.stamp-leave-active { transition: opacity 0.4s; }
.stamp-leave-to { opacity: 0; }
@keyframes stamp-in { from { opacity: 0; transform: scale(calc(1 + 0.6 * var(--fx-scale))) rotate(-2deg); } to { opacity: 1; transform: none; } }

.snippet { border: 1px solid rgba(25, 230, 255, 0.2); background: rgba(4, 5, 10, 0.7); }
.snippet-head { display: flex; align-items: center; justify-content: space-between; padding: 8px 14px; font-size: 10px; letter-spacing: 0.25em; color: var(--neon-cyan); border-bottom: 1px solid rgba(25, 230, 255, 0.14); }
.snippet pre { margin: 0; padding: 14px; overflow: auto; font-size: 13px; line-height: 1.6; color: var(--neon-green); user-select: text; -webkit-user-select: text; }
.feedback { padding: 0 14px 10px; min-height: 18px; font-size: 11px; color: var(--text-dim); }
</style>

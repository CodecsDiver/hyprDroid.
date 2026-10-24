<script setup lang="ts">
import ThemeEditor from '../components/theme/ThemeEditor.vue'
import { useThemeStore } from '../stores/themeStore'
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref } from 'vue'
import { readProjectFile } from '../backend/backend'
import TypingPanel from '../components/lab/TypingPanel.vue'
import ResizeHandle from '../components/shell/ResizeHandle.vue'
import TitleBar from '../components/shell/TitleBar.vue'
import { LAB_COURSES, findCourse } from '../lab/courses'
import { LAB_REPLAY_KEY } from '../lab/replay'
import { evaluateTyping, splitCode } from '../lab/typingCourse'
import { PANEL_LIMITS } from '../layout/resize'
import { formatMs } from '../ghost/ghostRecord'
import { usePracticeStore } from '../stores/practiceStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useUiStore } from '../stores/uiStore'
import type { SortFrame } from '../visualizers/algorithms/sorting'

const settings = useSettingsStore()
const theme = useThemeStore()
const ui = useUiStore()
const practice = usePracticeStore()
const SELECTED_COURSE_KEY = 'pydisc-lab-course'
const CELEBRATION_MS = 3600

const readSavedCourse = (): string => {
  try {
    return localStorage.getItem(SELECTED_COURSE_KEY) ?? ''
  } catch {
    return ''
  }
}
const selectedCourseId = ref(findCourse(readSavedCourse()) ? readSavedCourse() : LAB_COURSES[0].id)
const selectedCourse = computed(() => findCourse(selectedCourseId.value) ?? LAB_COURSES[0])
const groups = computed(() =>
  (['Sorting', 'Visualizers'] as const).map((group) => ({ group, courses: LAB_COURSES.filter((course) => course.group === group) })),
)

// --- completion marks: a course is complete once its typed file matches every line ---------------
const completedCourseIds = ref<string[]>([])
const isCompleted = (courseId: string) => completedCourseIds.value.includes(courseId)
const completedCount = (courses: readonly { id: string }[]) => courses.filter((course) => isCompleted(course.id)).length

function setCompleted(courseId: string, complete: boolean): void {
  const has = isCompleted(courseId)
  if (complete && !has) completedCourseIds.value = [...completedCourseIds.value, courseId]
  if (!complete && has) completedCourseIds.value = completedCourseIds.value.filter((id) => id !== courseId)
}

/** Reads every course's saved file once, so marks are right before any course is opened. */
async function loadCompletionMarks(): Promise<void> {
  await Promise.all(
    LAB_COURSES.map(async (course) => {
      try {
        const saved = await readProjectFile(`lab-${course.id}`, 'main.py')
        if (saved !== null && evaluateTyping(splitCode(course.code), saved).isComplete) setCompleted(course.id, true)
      } catch {
        // A course whose file cannot be read just shows as not complete.
      }
    }),
  )
}

// --- finish animation and "play my own code" -----------------------------------------------------
const replayToken = ref(0)
provide(LAB_REPLAY_KEY, replayToken)
const traceFrames = ref<SortFrame[] | null>(null)
const celebration = ref<{ id: number; headline: string; detail: string } | null>(null)
let celebrationCounter = 0
let celebrationTimer: ReturnType<typeof setTimeout> | undefined

const visualizerProps = computed(() => ({
  ...selectedCourse.value.visualizerProps,
  ...(selectedCourse.value.trace ? { traceFrames: traceFrames.value } : {}),
}))

async function onRan(result: { courseId: string; matched: boolean; frames: SortFrame[] | null }): Promise<void> {
  if (result.courseId !== selectedCourseId.value) return
  traceFrames.value = selectedCourse.value.trace ? result.frames : null
  if (!result.matched && !result.frames) return
  await nextTick()
  replayToken.value += 1
  if (!result.matched) return
  const id = ++celebrationCounter
  celebration.value = {
    id,
    headline: `YOUR ${selectedCourse.value.title.toUpperCase()} WORKS`,
    detail: result.frames ? 'Watch the visualizer: it is replaying what your code actually did.' : 'Watch the visualizer play the finished idea.',
  }
  clearTimeout(celebrationTimer)
  celebrationTimer = setTimeout(() => {
    if (celebration.value?.id === id) celebration.value = null
  }, CELEBRATION_MS)
}

const racingCourseId = ref<string | null>(null)

function select(courseId: string): void {
  selectedCourseId.value = courseId
  racingCourseId.value = null
  traceFrames.value = null
  celebration.value = null
  try {
    localStorage.setItem(SELECTED_COURSE_KEY, courseId)
  } catch {
    // Remembering the last course is a convenience only.
  }
}

const windowWidth = ref(window.innerWidth)
const windowHeight = ref(window.innerHeight)
const onResize = () => {
  windowWidth.value = window.innerWidth
  windowHeight.value = window.innerHeight
}
const sidebarMax = computed(() => Math.min(PANEL_LIMITS.sideMax, windowWidth.value - 600))
const typingMax = computed(() => Math.max(PANEL_LIMITS.outputMin, windowHeight.value - 38 - 200))

onMounted(async () => {
  await settings.load()
  await theme.load()
  await practice.load()
  window.addEventListener('resize', onResize)
  await loadCompletionMarks()
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  clearTimeout(celebrationTimer)
})
</script>

<template>
  <div class="lab">
    <div class="realm-backdrop" />
    <TitleBar data-theme-part="titlebar" title="Visualizer Lab" subtitle="// watch it, then type it">
      <button class="btn is-ghost" @click="ui.openThemeEditor()">&#9673; Theme</button>
      <span class="overall">{{ completedCourseIds.length }} / {{ LAB_COURSES.length }} complete</span>
    </TitleBar>

    <div class="body" :style="{ gridTemplateColumns: `${settings.layout.labSidebarWidth}px 12px minmax(0, 1fr)` }">
      <nav class="catalog panel" data-theme-part="lab">
        <div v-for="entry in groups" :key="entry.group" class="group">
          <div class="panel-title">{{ entry.group }} <span class="group-count">{{ completedCount(entry.courses) }} / {{ entry.courses.length }}</span></div>
          <ul>
            <li
              v-for="course in entry.courses"
              :key="course.id"
              :class="{ selected: course.id === selectedCourseId, complete: isCompleted(course.id) }"
              @click="select(course.id)"
            >
              <span class="mark" :title="isCompleted(course.id) ? 'Complete: you typed every line' : 'Not finished yet'">{{ isCompleted(course.id) ? '✓' : '○' }}</span>
              <span class="text">
                <span class="title">{{ course.title }}</span>
                <span class="tagline">{{ course.tagline }}</span>
              </span>
              <span v-if="practice.ghostFor(`lab:${course.id}`)" class="best-time" title="Your ghost's time">&#9201; {{ formatMs(practice.ghostFor(`lab:${course.id}`)!.ms) }}</span>
            </li>
          </ul>
        </div>
      </nav>

      <ResizeHandle
        orientation="vertical"
        label="course list"
        :size="settings.layout.labSidebarWidth"
        :min="PANEL_LIMITS.sideMin"
        :max="sidebarMax"
        :default-size="290"
        @update:size="settings.layout.labSidebarWidth = $event"
      />

      <main class="main" :style="{ gridTemplateRows: `minmax(120px, 1fr) 12px ${settings.layout.labTypingHeight}px` }">
        <section class="viz panel" data-theme-part="visualizer">
          <div class="panel-title">{{ selectedCourse.title }}<span v-if="isCompleted(selectedCourse.id)" class="done-badge">COMPLETE</span>
            <button v-if="isCompleted(selectedCourse.id) && racingCourseId !== selectedCourse.id" class="race-btn" title="Type it again against your fastest run" @click="racingCourseId = selectedCourse.id">&#9654; RACE GHOST</button>
          </div>
          <Transition name="celebrate">
            <div v-if="celebration" :key="celebration.id" class="celebration">
              <div class="celebration-headline">{{ celebration.headline }}</div>
              <div class="celebration-detail">{{ celebration.detail }}</div>
            </div>
          </Transition>
          <div class="viz-scroll">
            <component :is="selectedCourse.visualizer" :key="selectedCourse.id" v-bind="visualizerProps" />
          </div>
        </section>

        <ResizeHandle
          orientation="horizontal"
          label="typing panel"
          invert
          :size="settings.layout.labTypingHeight"
          :min="180"
          :max="typingMax"
          :default-size="340"
          @update:size="settings.layout.labTypingHeight = $event"
        />

        <TypingPanel
          data-theme-part="editor"
          :course="selectedCourse"
          :font-size="Math.min(settings.editorFontSize, 17)"
          :race="racingCourseId === selectedCourse.id"
          @completion="setCompleted"
          @ran="onRan"
          @race-ended="racingCourseId = null"
        />
      </main>
    </div>
    <ThemeEditor />
  </div>
</template>

<style scoped>
.lab { position: relative; display: flex; flex-direction: column; height: 100%; }
.body { position: relative; z-index: 1; flex: 1; min-height: 0; display: grid; padding: 12px; }
.overall { font-size: 11px; letter-spacing: 0.2em; color: var(--neon-green); text-shadow: var(--glow-green); }
.catalog { overflow: auto; min-height: 0; }
.group-count { margin-left: auto; color: var(--neon-green); letter-spacing: 0.1em; }
.group ul { list-style: none; margin: 0; padding: 8px; display: flex; flex-direction: column; gap: 6px; }
.catalog li { display: flex; align-items: center; gap: 10px; padding: 9px 12px; cursor: pointer; border-left: 3px solid rgb(var(--text-dim-rgb) / 0.35); background: rgba(255, 255, 255, 0.02); transition: background 0.15s, transform 0.15s, border-color 0.15s; }
.catalog li:hover { background: rgb(var(--neon-cyan-rgb) / 0.07); transform: translateX(3px); }
.catalog li.selected { border-left-color: var(--neon-violet); background: linear-gradient(90deg, rgb(var(--neon-violet-rgb) / 0.2), transparent); }
.catalog li.complete { border-left-color: var(--neon-green); }
.mark { width: 18px; text-align: center; color: var(--text-dim); font-weight: 900; }
.complete .mark { color: var(--neon-green); text-shadow: var(--glow-green); }
.text { display: flex; flex-direction: column; }
.title { font-weight: 700; }
.tagline { font-size: 11px; color: var(--text-dim); }
.main { display: grid; min-height: 0; min-width: 0; }
.viz { position: relative; display: flex; flex-direction: column; min-height: 0; background: rgb(var(--editor-bg-rgb) / 0.88); }
.viz-scroll { flex: 1; overflow: auto; padding: 14px 18px; }
.done-badge { margin-left: auto; padding: 1px 8px; font-size: 9px; letter-spacing: 0.25em; color: var(--void); background: var(--neon-green); box-shadow: var(--glow-green); }
.celebration {
  position: absolute; z-index: 5; top: 44px; left: 50%; transform: translateX(-50%); text-align: center; pointer-events: none;
  padding: 12px 28px; background: rgb(var(--void-rgb) / 0.92); border: 1px solid var(--neon-green); box-shadow: var(--glow-green), 0 0 60px rgb(var(--neon-green-rgb) / 0.25);
}
.celebration-headline { font-family: var(--font-display); font-size: 20px; font-weight: 900; letter-spacing: 0.2em; color: var(--neon-green); text-shadow: var(--glow-green); }
.celebration-detail { margin-top: 4px; font-size: 12px; color: var(--text); }
.celebrate-enter-active { animation: celebrate-in 0.55s cubic-bezier(0.2, 1.5, 0.3, 1); }
.celebrate-leave-active { transition: opacity 0.5s, transform 0.5s; }
.celebrate-leave-to { opacity: 0; transform: translateX(-50%) translateY(-14px); }
@keyframes celebrate-in { from { opacity: 0; transform: translateX(-50%) scale(calc(1 + 0.6 * var(--fx-scale))); } to { opacity: 1; transform: translateX(-50%) scale(1); } }
.best-time { margin-left: auto; align-self: center; font-size: 10px; letter-spacing: 0.1em; color: var(--neon-violet); white-space: nowrap; }
.race-btn {
  margin-left: 12px; padding: 1px 9px; font-size: 10px; letter-spacing: 0.16em; cursor: pointer;
  background: rgb(var(--neon-violet-rgb) / 0.12); border: 1px solid var(--neon-violet); color: var(--neon-violet);
}
.race-btn:hover { box-shadow: var(--glow-violet); }
</style>

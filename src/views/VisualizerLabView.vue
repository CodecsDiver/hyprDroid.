<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import TypingPanel from '../components/lab/TypingPanel.vue'
import ResizeHandle from '../components/shell/ResizeHandle.vue'
import TitleBar from '../components/shell/TitleBar.vue'
import { LAB_COURSES, findCourse } from '../lab/courses'
import { PANEL_LIMITS } from '../layout/resize'
import { useSettingsStore } from '../stores/settingsStore'

const settings = useSettingsStore()
const SELECTED_COURSE_KEY = 'pydisc-lab-course'

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

function select(courseId: string): void {
  selectedCourseId.value = courseId
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
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => window.removeEventListener('resize', onResize))
</script>

<template>
  <div class="lab">
    <div class="realm-backdrop" />
    <TitleBar title="Visualizer Lab" subtitle="// watch it, then type it" />

    <div class="body" :style="{ gridTemplateColumns: `${settings.layout.labSidebarWidth}px 12px minmax(0, 1fr)` }">
      <nav class="catalog panel">
        <div v-for="entry in groups" :key="entry.group" class="group">
          <div class="panel-title">{{ entry.group }}</div>
          <ul>
            <li v-for="course in entry.courses" :key="course.id" :class="{ selected: course.id === selectedCourseId }" @click="select(course.id)">
              <span class="title">{{ course.title }}</span>
              <span class="tagline">{{ course.tagline }}</span>
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
        <section class="viz panel">
          <div class="panel-title">{{ selectedCourse.title }}</div>
          <div class="viz-scroll">
            <component :is="selectedCourse.visualizer" :key="selectedCourse.id" v-bind="selectedCourse.visualizerProps" />
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

        <TypingPanel :course="selectedCourse" :font-size="Math.min(settings.editorFontSize, 17)" />
      </main>
    </div>
  </div>
</template>

<style scoped>
.lab { position: relative; display: flex; flex-direction: column; height: 100%; }
.body { position: relative; z-index: 1; flex: 1; min-height: 0; display: grid; padding: 12px; }
.catalog { overflow: auto; min-height: 0; }
.group ul { list-style: none; margin: 0; padding: 8px; display: flex; flex-direction: column; gap: 6px; }
.catalog li { display: flex; flex-direction: column; padding: 9px 12px; cursor: pointer; border-left: 3px solid rgba(113, 134, 160, 0.35); background: rgba(255, 255, 255, 0.02); transition: background 0.15s, transform 0.15s, border-color 0.15s; }
.catalog li:hover { background: rgba(25, 230, 255, 0.07); transform: translateX(3px); }
.catalog li.selected { border-left-color: var(--neon-violet); background: linear-gradient(90deg, rgba(164, 92, 255, 0.2), transparent); }
.title { font-weight: 700; }
.tagline { font-size: 11px; color: var(--text-dim); }
.main { display: grid; min-height: 0; min-width: 0; }
.viz { display: flex; flex-direction: column; min-height: 0; background: rgba(6, 9, 18, 0.88); }
.viz-scroll { flex: 1; overflow: auto; padding: 14px 18px; }
</style>

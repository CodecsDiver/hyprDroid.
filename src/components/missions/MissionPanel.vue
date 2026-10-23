<script setup lang="ts">
import { PROJECTS } from '../../curriculum/projects'
import { objectiveXp } from '../../gamification/progressionEngine'
import { useProgressionStore } from '../../stores/progressionStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'

const workspace = useWorkspaceStore()
const progression = useProgressionStore()

function projectProgress(projectId: string): number {
  const project = PROJECTS.find((candidate) => candidate.id === projectId)!
  return project.objectives.filter((objective) => progression.hasMetObjective(projectId, objective.id)).length
}

const difficultyBars = (difficulty: number) => Array.from({ length: 5 }, (_, index) => index < difficulty)
</script>

<template>
  <aside class="missions panel">
    <div class="panel-title">Missions</div>

    <ul class="project-list">
      <li
        v-for="project in PROJECTS"
        :key="project.id"
        class="project"
        :class="{
          selected: project.id === workspace.selectedProjectId,
          complete: progression.hasCompletedProject(project.id),
        }"
        @click="workspace.selectProject(project.id)"
      >
        <div class="project-head">
          <span class="project-title">{{ project.title }}</span>
          <span v-if="progression.hasCompletedProject(project.id)" class="stamp">CLEARED</span>
          <span v-else class="count">{{ projectProgress(project.id) }}/{{ project.objectives.length }}</span>
        </div>
        <div class="project-tagline">{{ project.tagline }}</div>
        <div class="difficulty">
          <i v-for="(filled, index) in difficultyBars(project.difficulty)" :key="index" :class="{ filled }" />
        </div>
      </li>
    </ul>

    <div class="panel-title">Objectives</div>
    <div class="objectives">
      <p class="summary">{{ workspace.selectedProject.summary }}</p>
      <div
        v-for="objective in workspace.selectedProject.objectives"
        :key="objective.id"
        class="objective"
        :class="{
          met: progression.hasMetObjective(workspace.selectedProject.id, objective.id),
          failed: workspace.objectiveResults[objective.id] && workspace.objectiveResults[objective.id].status !== 'pass',
        }"
      >
        <span class="checkbox">
          <template v-if="progression.hasMetObjective(workspace.selectedProject.id, objective.id)">&#10003;</template>
          <template v-else-if="workspace.objectiveResults[objective.id]">&#10005;</template>
        </span>
        <div class="objective-text">
          <div class="objective-title">{{ objective.title }}</div>
          <div v-if="workspace.objectiveResults[objective.id]?.status !== 'pass' || !progression.hasMetObjective(workspace.selectedProject.id, objective.id)" class="objective-detail">
            <template v-if="workspace.objectiveResults[objective.id] && workspace.objectiveResults[objective.id].status !== 'pass'">
              <span class="why">{{ workspace.objectiveResults[objective.id].message }}</span>
            </template>
            <template v-else>{{ objective.hint }}</template>
          </div>
        </div>
        <span class="reward">+{{ objectiveXp(workspace.selectedProject.difficulty) }}</span>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.missions { display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
.project-list { list-style: none; margin: 0; padding: 8px; display: flex; flex-direction: column; gap: 6px; max-height: 54%; overflow: auto; flex-shrink: 0; }
.project {
  padding: 9px 12px; cursor: pointer; border-left: 3px solid rgba(113, 134, 160, 0.35);
  background: rgba(255, 255, 255, 0.02); transition: background 0.15s, border-color 0.15s, transform 0.15s;
}
.project:hover { background: rgba(25, 230, 255, 0.07); transform: translateX(3px); }
.project.selected { border-left-color: var(--neon-green); background: linear-gradient(90deg, rgba(57, 255, 136, 0.16), transparent); box-shadow: inset 0 0 18px rgba(57, 255, 136, 0.06); }
.project-head { display: flex; justify-content: space-between; align-items: center; }
.project-title { font-weight: 700; color: var(--text); }
.count { color: var(--text-dim); font-size: 11px; }
.stamp { font-size: 9px; letter-spacing: 0.2em; padding: 1px 6px; color: var(--void); background: var(--neon-green); box-shadow: var(--glow-green); }
.project-tagline { margin-top: 2px; font-size: 11px; color: var(--text-dim); }
.difficulty { display: flex; gap: 3px; margin-top: 6px; }
.difficulty i { width: 16px; height: 4px; background: rgba(113, 134, 160, 0.25); transform: skewX(-30deg); }
.difficulty i.filled { background: var(--neon-violet); box-shadow: 0 0 6px var(--neon-violet); }

.objectives { flex: 1; overflow: auto; padding: 10px 12px 14px; display: flex; flex-direction: column; gap: 8px; }
.summary { margin: 0 0 4px; color: var(--text-dim); font-size: 12px; line-height: 1.5; }
.objective {
  display: grid; grid-template-columns: 22px 1fr auto; gap: 10px; align-items: start; padding: 9px 10px;
  border: 1px solid rgba(113, 134, 160, 0.25); background: rgba(4, 5, 10, 0.5);
  transition: border-color 0.3s, background 0.3s, box-shadow 0.3s;
}
.checkbox {
  display: grid; place-items: center; width: 20px; height: 20px; font-weight: 900;
  border: 1px solid rgba(113, 134, 160, 0.6); color: var(--void); transform: rotate(45deg) scale(0.8);
}
.checkbox > * { transform: rotate(-45deg); }
.objective-title { font-weight: 700; }
.objective-detail { margin-top: 3px; font-size: 11px; line-height: 1.45; color: var(--text-dim); }
.reward { font-size: 11px; color: var(--text-dim); }
.objective.met { border-color: var(--neon-green); background: rgba(57, 255, 136, 0.08); box-shadow: inset 0 0 20px rgba(57, 255, 136, 0.08); }
.objective.met .checkbox { background: var(--neon-green); border-color: var(--neon-green); box-shadow: var(--glow-green); }
.objective.met .reward { color: var(--neon-green); text-decoration: line-through; opacity: 0.6; }
.objective.met .objective-detail { display: none; }
.objective.failed { border-color: var(--neon-red); background: rgba(255, 61, 110, 0.07); }
.objective.failed .checkbox { background: var(--neon-red); border-color: var(--neon-red); }
.why { color: var(--neon-red); }
</style>

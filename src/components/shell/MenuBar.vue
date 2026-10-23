<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue'
import { APP_COMMANDS_KEY } from '../../commands/injection'
import type { AppCommand } from '../../commands/commandRegistry'
import { isNativeRuntime } from '../../backend/backend'
import { PROJECTS } from '../../curriculum/projects'

type MenuEntry = string | '---'

const commands = inject(APP_COMMANDS_KEY, [] as AppCommand[])
const byId = computed(() => new Map(commands.map((command) => [command.id, command])))

const MENUS: ReadonlyArray<{ label: string; entries: MenuEntry[] }> = [
  { label: 'File', entries: ['file.save', 'file.import', 'file.export', '---', 'file.reset', '---', 'file.lab', ...(isNativeRuntime() ? ['---', 'file.close'] : [])] },
  { label: 'Edit', entries: ['edit.undo', 'edit.redo', '---', 'edit.cut', 'edit.copy', '---', 'edit.selectAll', '---', 'edit.find', 'edit.replace', '---', 'edit.comment', 'edit.gotoLine'] },
  {
    label: 'View',
    entries: [
      'view.palette', '---', 'view.missions', 'view.quests', 'view.output', 'view.focus', '---',
      'view.zoomIn', 'view.zoomOut', 'view.zoomReset', '---',
      'view.fx.off', 'view.fx.low', 'view.fx.medium', 'view.fx.high', '---',
      'view.sound', 'view.shake', '---', 'view.resetLayout', 'view.fullscreen',
    ],
  },
  { label: 'Run', entries: ['run.run', 'run.check', '---', 'run.clear'] },
  { label: 'Go', entries: ['go.next', 'go.previous', '---', ...PROJECTS.map((project) => `go.mission.${project.id}`)] },
  { label: 'Help', entries: ['help.shortcuts', 'help.about'] },
]

const openMenu = ref<string | null>(null)
// Hovering onto a title while another menu is open switches to it; the click that follows must keep it open.
let switchedByHover: string | null = null

function hoverMenu(label: string): void {
  if (openMenu.value && openMenu.value !== label) {
    openMenu.value = label
    switchedByHover = label
  }
}

function toggleMenu(label: string): void {
  if (switchedByHover === label) {
    switchedByHover = null
    return
  }
  openMenu.value = openMenu.value === label ? null : label
}
const root = ref<HTMLElement>()

function menuItems(entries: MenuEntry[]): Array<AppCommand | null> {
  return entries.map((entry) => (entry === '---' ? null : (byId.value.get(entry) ?? null)))
}

function activate(command: AppCommand): void {
  if (command.isEnabled && !command.isEnabled()) return
  openMenu.value = null
  void command.run()
}

function closeOnOutsideClick(event: MouseEvent): void {
  if (root.value && !root.value.contains(event.target as Node)) openMenu.value = null
}

function closeOnEscape(event: KeyboardEvent): void {
  if (event.key === 'Escape') openMenu.value = null
}

onMounted(() => {
  window.addEventListener('mousedown', closeOnOutsideClick)
  window.addEventListener('keydown', closeOnEscape)
})
onBeforeUnmount(() => {
  window.removeEventListener('mousedown', closeOnOutsideClick)
  window.removeEventListener('keydown', closeOnEscape)
})
</script>

<template>
  <nav ref="root" class="menubar" aria-label="Application menu">
    <div v-for="menu in MENUS" :key="menu.label" class="menu">
      <button
        class="menu-title"
        :class="{ open: openMenu === menu.label }"
        @click="toggleMenu(menu.label)"
        @mouseenter="hoverMenu(menu.label)"
      >{{ menu.label }}</button>
      <ul v-if="openMenu === menu.label" class="dropdown" role="menu">
        <template v-for="(command, index) in menuItems(menu.entries)" :key="index">
          <li v-if="command === null" class="separator" role="separator" />
          <li
            v-else
            class="item"
            :class="{ disabled: command.isEnabled && !command.isEnabled() }"
            role="menuitem"
            @click="activate(command)"
          >
            <span class="check">{{ command.isChecked?.() ? '✓' : '' }}</span>
            <span class="label">{{ command.title }}</span>
            <span class="shortcut">{{ command.shortcuts?.[0] ?? '' }}</span>
          </li>
        </template>
      </ul>
    </div>
    <div class="spacer" />
    <button class="palette-button" title="Command palette (F1 or Ctrl+Shift+P)" @click="commands.find((c) => c.id === 'view.palette')?.run()">
      &#9906; Command palette <span class="kbd">F1</span>
    </button>
  </nav>
</template>

<style scoped>
.menubar {
  position: relative; z-index: 20; display: flex; align-items: center; height: 30px; padding: 0 8px;
  background: linear-gradient(180deg, #0f1424, #0a0e1a); border-bottom: 1px solid rgba(25, 230, 255, 0.22);
}
.menu { position: relative; }
.menu-title {
  height: 30px; padding: 0 12px; border: 0; background: transparent; color: var(--text); cursor: pointer;
  font-size: 12px; letter-spacing: 0.04em;
}
.menu-title:hover, .menu-title.open { background: rgba(25, 230, 255, 0.14); color: var(--neon-cyan); }
.dropdown {
  position: absolute; top: 30px; left: 0; min-width: 300px; margin: 0; padding: 6px 0; list-style: none;
  background: var(--hull-raised); border: 1px solid var(--glass-edge); box-shadow: 0 14px 40px rgba(0, 0, 0, 0.7), var(--glow-cyan);
}
.item { display: grid; grid-template-columns: 22px 1fr auto; align-items: center; gap: 8px; padding: 6px 14px 6px 8px; cursor: pointer; font-size: 12px; }
.item:hover:not(.disabled) { background: rgba(25, 230, 255, 0.16); }
.item.disabled { opacity: 0.38; cursor: default; }
.check { text-align: center; color: var(--neon-green); }
.shortcut { color: var(--text-dim); font-size: 11px; padding-left: 24px; }
.separator { height: 1px; margin: 5px 0; background: rgba(25, 230, 255, 0.16); }
.spacer { flex: 1; }
.palette-button {
  display: flex; align-items: center; gap: 8px; height: 22px; padding: 0 10px; cursor: pointer; font-size: 11px;
  color: var(--text-dim); background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(113, 134, 160, 0.35);
}
.palette-button:hover { color: var(--neon-cyan); border-color: var(--neon-cyan); }
</style>

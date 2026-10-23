<script setup lang="ts">
import { getCurrentWindow } from '@tauri-apps/api/window'
import { isNativeRuntime } from '../../backend/backend'

defineProps<{ title: string; subtitle?: string }>()

function withWindow(action: (windowHandle: ReturnType<typeof getCurrentWindow>) => Promise<void>): void {
  if (isNativeRuntime()) void action(getCurrentWindow())
}
const startDragging = () => withWindow((w) => w.startDragging())
const minimize = () => withWindow((w) => w.minimize())
const toggleMaximize = () => withWindow((w) => w.toggleMaximize())
const close = () => withWindow((w) => w.close())
</script>

<template>
  <header class="titlebar" @mousedown.left.self="startDragging" @dblclick.self="toggleMaximize">
    <div class="brand" @mousedown.left="startDragging" @dblclick="toggleMaximize">
      <span class="brand-glyph">&lt;/&gt;</span>
      <span class="brand-title">{{ title }}</span>
      <span v-if="subtitle" class="brand-subtitle">{{ subtitle }}</span>
    </div>
    <div class="titlebar-slot"><slot /></div>
    <div v-if="isNativeRuntime()" class="window-controls">
      <button class="control" title="Minimize" @click="minimize">&#8211;</button>
      <button class="control" title="Maximize" @click="toggleMaximize">&#9633;</button>
      <button class="control control-close" title="Close" @click="close">&#10005;</button>
    </div>
  </header>
</template>

<style scoped>
.titlebar {
  position: relative;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 16px;
  height: 38px;
  padding: 0 0 0 14px;
  background: linear-gradient(180deg, #1b2236 0%, #0c101c 100%);
  border-bottom: 1px solid rgba(25, 230, 255, 0.35);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.06) inset, 0 4px 18px rgba(0, 0, 0, 0.6);
}
.brand { display: flex; align-items: center; gap: 10px; cursor: default; }
.brand-glyph { color: var(--neon-green); text-shadow: var(--glow-green); font-weight: 700; }
.brand-title {
  font-family: var(--font-display);
  font-size: 12px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--text);
}
.brand-subtitle { color: var(--text-dim); font-size: 11px; letter-spacing: 0.12em; }
.titlebar-slot { flex: 1; display: flex; justify-content: center; align-items: center; gap: 10px; }
.window-controls { display: flex; height: 100%; }
.titlebar:not(:has(.window-controls)) { padding-right: 14px; }
.control {
  width: 46px;
  border: 0;
  background: transparent;
  color: var(--text-dim);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.control:hover { background: rgba(25, 230, 255, 0.14); color: var(--neon-cyan); }
.control-close:hover { background: var(--neon-red); color: #fff; }
</style>

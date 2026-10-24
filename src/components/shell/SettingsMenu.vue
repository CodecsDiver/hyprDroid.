<script setup lang="ts">
import { ref } from 'vue'
import { type AnimationIntensity, useSettingsStore } from '../../stores/settingsStore'

const settings = useSettingsStore()
const isOpen = ref(false)
const intensities: AnimationIntensity[] = ['off', 'low', 'medium', 'high']
</script>

<template>
  <div class="settings">
    <button class="btn is-ghost" @click="isOpen = !isOpen">&#9881; FX</button>
    <div v-if="isOpen" class="menu panel">
      <div class="panel-title">Settings</div>
      <div class="body">
        <div class="label">Animation intensity</div>
        <div class="segments">
          <button
            v-for="level in intensities"
            :key="level"
            class="segment"
            :class="{ on: settings.animationIntensity === level }"
            @click="settings.animationIntensity = level"
          >{{ level }}</button>
        </div>
        <label class="toggle"><input v-model="settings.soundEnabled" type="checkbox" /> Sound effects</label>
        <label class="toggle"><input v-model="settings.screenShakeEnabled" type="checkbox" /> Screen shake</label>
        <label class="toggle"><input v-model="settings.focusMode" type="checkbox" /> Focus mode (dim side panels)</label>
        <button class="btn is-ghost" @click="settings.resetLayout()">Reset panel sizes</button>
        <p class="note">Drag the glowing bars between panels to resize them. Double-click a bar to reset it.</p>
        <p class="note">Intensity scales particles, glow and motion. "Off" also respects your system's reduced-motion setting.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings { position: relative; }
.menu { position: absolute; right: 0; top: 44px; width: 300px; z-index: 60; background: var(--hull-raised); }
.body { padding: 12px 16px 16px; display: flex; flex-direction: column; gap: 10px; }
.label { font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--text-dim); }
.segments { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
.segment { padding: 7px 0; text-transform: uppercase; font-size: 10px; letter-spacing: 0.1em; cursor: pointer; background: transparent; border: 1px solid rgb(var(--text-dim-rgb) / 0.4); color: var(--text-dim); }
.segment.on { color: var(--void); background: var(--neon-cyan); border-color: var(--neon-cyan); box-shadow: var(--glow-cyan); }
.toggle { display: flex; gap: 8px; align-items: center; cursor: pointer; }
.toggle input { accent-color: var(--neon-green); }
.note { margin: 0; font-size: 11px; color: var(--text-dim); line-height: 1.5; }
</style>

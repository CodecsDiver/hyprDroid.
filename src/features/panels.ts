import { defineAsyncComponent, type Component } from 'vue'
import type { ActivePanel } from '@/state/ui'

export interface PanelDefinition {
  title: string
  icon: string
  theme?: 'default' | 'spell'
  /** Takes over the whole screen (and pauses the 3D scene). */
  fullscreen?: boolean
  component: Component
}

/** Panels are code-split: nothing loads until its object is first opened. */
export const PANELS: Readonly<Record<ActivePanel, PanelDefinition>> = {
  'love-ping': { title: 'Love Ping', icon: '🌹', component: defineAsyncComponent(() => import('./love-ping/LovePingPanel.vue')) },
  listening: { title: 'Listening Together', icon: '🎸', component: defineAsyncComponent(() => import('./listening/ListeningPanel.vue')) },
  garden: { title: 'Mood Garden', icon: '🌱', component: defineAsyncComponent(() => import('./garden/GardenPanel.vue')) },
  'date-jar': { title: 'Date Jar', icon: '🫙', component: defineAsyncComponent(() => import('./date-jar/DateJarPanel.vue')) },
  'hidden-notes': { title: 'Hidden Notes', icon: '✉️', component: defineAsyncComponent(() => import('./hidden-notes/HiddenNotesPanel.vue')) },
  mischief: { title: 'Mischief Mode', icon: '🎈', component: defineAsyncComponent(() => import('./mischief/MischiefPanel.vue')) },
  'spell-table': { title: "Vee's Spell Table", icon: '🔮', theme: 'spell', component: defineAsyncComponent(() => import('./spell-table/SpellTablePanel.vue')) },
  'love-universe': { title: 'Love Universe', icon: '💗', fullscreen: true, component: defineAsyncComponent(() => import('./love-universe/LoveUniversePanel.vue')) },
  vault: { title: 'Memory Vault', icon: '📷', component: defineAsyncComponent(() => import('./vault/VaultPanel.vue')) },
  'time-capsule': { title: 'Time Capsule', icon: '⏳', fullscreen: true, component: defineAsyncComponent(() => import('./time-capsule/TimeCapsulePanel.vue')) },
  calendar: { title: 'Calendar', icon: '📅', component: defineAsyncComponent(() => import('./calendar/CalendarPanel.vue')) },
  daily: { title: 'Question of the day', icon: '🪧', component: defineAsyncComponent(() => import('./daily/DailyPanel.vue')) },
  postcards: { title: 'Postcards', icon: '📮', component: defineAsyncComponent(() => import('./postcards/PostcardsPanel.vue')) },
  settings: { title: 'Settings', icon: '⚙️', component: defineAsyncComponent(() => import('./settings/SettingsPanel.vue')) },
}

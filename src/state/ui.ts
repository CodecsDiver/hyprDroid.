import { reactive } from 'vue'
import { PANEL_IDS, type PanelId } from '@/registry/interactionRegistry'

export type ActivePanel = PanelId | 'settings'

export const ui = reactive<{ panel: ActivePanel | null; objectId: string | null }>({ panel: null, objectId: null })

export function isPanelId(value: unknown): value is ActivePanel {
  return value === 'settings' || (typeof value === 'string' && (PANEL_IDS as readonly string[]).includes(value))
}

export function openPanel(panel: ActivePanel, objectId: string | null = null): void {
  ui.panel = panel
  ui.objectId = objectId
}

export function closePanel(): void {
  ui.panel = null
  ui.objectId = null
}

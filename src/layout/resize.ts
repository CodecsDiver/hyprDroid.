export interface PanelLayout {
  leftWidth: number
  rightWidth: number
  outputHeight: number
  labSidebarWidth: number
  labTypingHeight: number
}

export const DEFAULT_LAYOUT: PanelLayout = { leftWidth: 300, rightWidth: 290, outputHeight: 220, labSidebarWidth: 290, labTypingHeight: 340 }

export const PANEL_LIMITS = {
  sideMin: 200,
  sideMax: 560,
  outputMin: 80,
  /** The editor column always keeps at least this much room. */
  centerMinWidth: 380,
  editorMinHeight: 200,
} as const

export function clampSize(value: number, min: number, max: number): number {
  // When the window is too small for the limits, the minimum wins so panels never vanish.
  return Math.round(Math.max(min, Math.min(value, Math.max(min, max))))
}

/** New size after dragging a handle by `delta` pixels. `invert` is for handles on a panel's leading edge. */
export function resizedSize(startSize: number, delta: number, invert: boolean, min: number, max: number): number {
  return clampSize(startSize + (invert ? -delta : delta), min, max)
}

/** Reads saved layout values defensively: anything not a finite number falls back to the default. */
export function sanitizeLayout(stored: Partial<Record<keyof PanelLayout, unknown>> | undefined): PanelLayout {
  const layout = { ...DEFAULT_LAYOUT }
  for (const key of Object.keys(layout) as Array<keyof PanelLayout>) {
    const value = stored?.[key]
    if (typeof value === 'number' && Number.isFinite(value) && value >= 40 && value <= 4000) layout[key] = Math.round(value)
  }
  return layout
}

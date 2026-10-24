export type TokenKind = 'color' | 'font' | 'number'

export interface ThemeToken {
  id: string
  /** The CSS custom property the stylesheet reads. */
  cssVar: string
  /** For colours that other CSS wants with an alpha: a variable holding "r g b". */
  rgbVar?: string
  label: string
  group: string
  kind: TokenKind
  /** Shown in the editor when nothing is overridden. For colours it is the real default hex. */
  defaultValue: string
  /** Colour tokens that follow another token until the student sets their own value. */
  fallbackOf?: string
  /** Parts of the app this token affects; used by "pick an element". */
  parts: string[]
  /** The CSS variable holds "r g b" instead of a colour (so CSS can add its own alpha). */
  tripletOnly?: boolean
  unit?: string
  min?: number
  max?: number
  step?: number
}

const color = (
  id: string, cssVar: string, label: string, group: string, defaultValue: string, parts: string[],
  options: { rgbVar?: string; fallbackOf?: string; tripletOnly?: boolean } = {},
): ThemeToken => ({ id, cssVar, label, group, kind: 'color', defaultValue, parts, ...options })

export const PART_LABELS: Record<string, string> = {
  titlebar: 'Title bar',
  menubar: 'Menu bar',
  hud: 'Player HUD',
  levelbar: 'XP bar',
  combo: 'Combo meter',
  missions: 'Missions panel',
  quests: 'Quests panel',
  editor: 'Code editor',
  tabs: 'File tabs & buttons',
  output: 'Output panel',
  banners: 'Banners & level-up',
  lab: 'Visualizer Lab',
  visualizer: 'Visualizers',
  global: 'Whole app',
}

export const THEME_TOKENS: ThemeToken[] = [
  // Surfaces
  color('void', '--void', 'Page background', 'Surfaces', '#04050a', ['global', 'missions', 'quests', 'output', 'lab'], { rgbVar: '--void-rgb' }),
  color('hull', '--hull', 'Panel base', 'Surfaces', '#080b14', ['missions', 'quests', 'lab', 'editor'], { rgbVar: '--hull-rgb' }),
  color('hullRaised', '--hull-raised', 'Menus & dialogs', 'Surfaces', '#0d1220', ['menubar', 'global']),
  color('glassTint', '--glass-rgb', 'Panel glass tint', 'Surfaces', '#0c1222', ['hud', 'missions', 'quests', 'lab'], { tripletOnly: true }),
  color('metalLight', '--metal-light', 'Metal highlight', 'Surfaces', '#5a6682', ['titlebar', 'visualizer']),
  color('metalDark', '--metal-dark', 'Metal shadow', 'Surfaces', '#161c2c', ['titlebar']),
  // Accents
  color('neonGreen', '--neon-green', 'Accent: green (success)', 'Accents', '#39ff88', ['global', 'hud', 'tabs', 'banners', 'visualizer'], { rgbVar: '--neon-green-rgb' }),
  color('neonCyan', '--neon-cyan', 'Accent: cyan (primary)', 'Accents', '#19e6ff', ['global', 'hud', 'menubar', 'banners', 'visualizer'], { rgbVar: '--neon-cyan-rgb' }),
  color('neonViolet', '--neon-violet', 'Accent: violet', 'Accents', '#a45cff', ['global', 'hud', 'tabs', 'banners', 'visualizer'], { rgbVar: '--neon-violet-rgb' }),
  color('neonAmber', '--neon-amber', 'Accent: amber (warning)', 'Accents', '#ffc83d', ['global', 'tabs', 'banners', 'visualizer'], { rgbVar: '--neon-amber-rgb' }),
  color('neonRed', '--neon-red', 'Accent: red (error)', 'Accents', '#ff3d6e', ['global', 'output', 'banners'], { rgbVar: '--neon-red-rgb' }),
  // Text
  color('text', '--text', 'Text', 'Text', '#dbe8f5', ['global', 'titlebar', 'menubar', 'missions', 'quests', 'output']),
  color('textDim', '--text-dim', 'Secondary text', 'Text', '#7186a0', ['global', 'missions', 'quests', 'combo', 'output'], { rgbVar: '--text-dim-rgb' }),
  // Title & menu bars
  color('titlebarTop', '--titlebar-top', 'Title bar: top', 'Title bar & menus', '#1b2236', ['titlebar']),
  color('titlebarBottom', '--titlebar-bottom', 'Title bar: bottom', 'Title bar & menus', '#0c101c', ['titlebar']),
  color('menubarTop', '--menubar-top', 'Menu bar: top', 'Title bar & menus', '#0f1424', ['menubar']),
  color('menubarBottom', '--menubar-bottom', 'Menu bar: bottom', 'Title bar & menus', '#0a0e1a', ['menubar']),
  // HUD
  color('levelBarFrom', '--level-bar-from', 'XP bar: start', 'HUD & bars', '#39ff88', ['levelbar'], { fallbackOf: 'neonGreen' }),
  color('levelBarMid', '--level-bar-mid', 'XP bar: middle', 'HUD & bars', '#19e6ff', ['levelbar'], { fallbackOf: 'neonCyan' }),
  color('levelBarTo', '--level-bar-to', 'XP bar: end', 'HUD & bars', '#a45cff', ['levelbar'], { fallbackOf: 'neonViolet' }),
  color('comboT1', '--combo-t1', 'Combo: x1', 'HUD & bars', '#39ff88', ['combo'], { fallbackOf: 'neonGreen' }),
  color('comboT2', '--combo-t2', 'Combo: x2', 'HUD & bars', '#19e6ff', ['combo'], { fallbackOf: 'neonCyan' }),
  color('comboT3', '--combo-t3', 'Combo: x3', 'HUD & bars', '#a45cff', ['combo'], { fallbackOf: 'neonViolet' }),
  color('comboT4', '--combo-t4', 'Combo: x4', 'HUD & bars', '#ffc83d', ['combo'], { fallbackOf: 'neonAmber' }),
  color('comboT5', '--combo-t5', 'Combo: x5', 'HUD & bars', '#ff3d6e', ['combo'], { fallbackOf: 'neonRed' }),
  // Editor
  color('editorBackground', '--editor-bg', 'Editor background', 'Code editor', '#060912', ['editor']),
  color('editorLineHighlight', '--editor-line-highlight', 'Current line', 'Code editor', '#101a2e', ['editor']),
  color('editorSelection', '--editor-selection', 'Selection', 'Code editor', '#19e6ff', ['editor'], { fallbackOf: 'neonCyan' }),
  color('editorCursor', '--editor-cursor', 'Cursor', 'Code editor', '#39ff88', ['editor'], { fallbackOf: 'neonGreen' }),
  color('editorLineNumber', '--editor-line-number', 'Line numbers', 'Code editor', '#3b4d66', ['editor']),
  color('editorLineNumberActive', '--editor-line-number-active', 'Current line number', 'Code editor', '#19e6ff', ['editor'], { fallbackOf: 'neonCyan' }),
  color('editorText', '--editor-text', 'Code text', 'Code editor', '#dbe8f5', ['editor'], { fallbackOf: 'text' }),
  color('editorKeyword', '--editor-keyword', 'Keywords (def, if, for)', 'Code editor', '#a45cff', ['editor'], { fallbackOf: 'neonViolet' }),
  color('editorString', '--editor-string', 'Strings', 'Code editor', '#39ff88', ['editor'], { fallbackOf: 'neonGreen' }),
  color('editorNumber', '--editor-number', 'Numbers', 'Code editor', '#ffc83d', ['editor'], { fallbackOf: 'neonAmber' }),
  color('editorComment', '--editor-comment', 'Comments', 'Code editor', '#5b7a8c', ['editor']),
  color('editorOperator', '--editor-operator', 'Brackets & operators', 'Code editor', '#19e6ff', ['editor'], { fallbackOf: 'neonCyan' }),
  // Visualizers
  color('gridWall', '--grid-wall', 'Pathfinding walls', 'Visualizers', '#2a3350', ['visualizer']),
  color('curveSquare', '--curve-n2', 'Big-O: n² curve', 'Visualizers', '#ff7a3d', ['visualizer']),
  // Typography and shape
  { id: 'fontUi', cssVar: '--font-ui', label: 'Interface font', group: 'Fonts & shape', kind: 'font', parts: ['global'],
    defaultValue: "'JetBrains Mono', 'Fira Code', 'DejaVu Sans Mono', ui-monospace, monospace" },
  { id: 'fontDisplay', cssVar: '--font-display', label: 'Headline font', group: 'Fonts & shape', kind: 'font', parts: ['titlebar', 'hud', 'banners', 'tabs'],
    defaultValue: "'Orbitron', 'Eurostile', 'DejaVu Sans Mono', ui-monospace, monospace" },
  { id: 'fontEditor', cssVar: '--font-editor', label: 'Code font', group: 'Fonts & shape', kind: 'font', parts: ['editor'],
    defaultValue: "'JetBrains Mono', 'Fira Code', 'DejaVu Sans Mono', monospace" },
  { id: 'cut', cssVar: '--cut', label: 'Corner cut size', group: 'Fonts & shape', kind: 'number', parts: ['missions', 'quests', 'hud', 'lab'], defaultValue: '12', unit: 'px', min: 0, max: 28, step: 1 },
  { id: 'glassAlpha', cssVar: '--glass-alpha', label: 'Panel opacity', group: 'Fonts & shape', kind: 'number', parts: ['hud', 'missions', 'quests', 'lab'], defaultValue: '0.78', min: 0.2, max: 1, step: 0.02 },
  { id: 'glowSize', cssVar: '--glow-size', label: 'Glow size', group: 'Fonts & shape', kind: 'number', parts: ['global', 'banners'], defaultValue: '14', unit: 'px', min: 0, max: 40, step: 1 },
]

export const TOKEN_BY_ID: ReadonlyMap<string, ThemeToken> = new Map(THEME_TOKENS.map((token) => [token.id, token]))
export const TOKEN_GROUPS: string[] = [...new Set(THEME_TOKENS.map((token) => token.group))]
export const ACCENT_TOKEN_IDS = ['neonGreen', 'neonCyan', 'neonViolet', 'neonAmber', 'neonRed'] as const

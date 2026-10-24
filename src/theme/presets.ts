import type { ThemeOverrides } from './applyTheme'

export interface ThemePreset {
  name: string
  description: string
  overrides: ThemeOverrides
}

export const THEME_PRESETS: ThemePreset[] = [
  { name: 'Cyber (default)', description: 'The original near-black neon look.', overrides: {} },
  {
    name: 'Synthwave',
    description: 'Hot pink and electric blue on deep purple.',
    overrides: {
      void: '#0d0221', hull: '#150533', hullRaised: '#1d0a45', glassTint: '#1a0840', metalLight: '#7a4fb5', metalDark: '#2a1058',
      neonGreen: '#00ffc8', neonCyan: '#26c6ff', neonViolet: '#ff3cac', neonAmber: '#ffd23f', neonRed: '#ff4d6d',
      text: '#f4e9ff', textDim: '#a98bd0', titlebarTop: '#2a1058', titlebarBottom: '#150533', menubarTop: '#1d0a45', menubarBottom: '#120430',
      editorBackground: '#10032b', editorLineHighlight: '#240a52', editorLineNumber: '#6a4a9a', editorComment: '#8a6fb5',
    },
  },
  {
    name: 'Matrix',
    description: 'Green on black, nothing else.',
    overrides: {
      void: '#000600', hull: '#010d02', hullRaised: '#02160a', glassTint: '#021208', metalLight: '#2f6b3a', metalDark: '#0a2a12',
      neonGreen: '#2bff5a', neonCyan: '#7dffa0', neonViolet: '#19b84a', neonAmber: '#c8ff3d', neonRed: '#ff5a3d',
      text: '#c9ffd6', textDim: '#4f9a63', titlebarTop: '#0a2a12', titlebarBottom: '#010d02', menubarTop: '#02160a', menubarBottom: '#010a04',
      editorBackground: '#000a02', editorLineHighlight: '#06240f', editorLineNumber: '#2f6b3a', editorComment: '#3f8a52',
    },
  },
  {
    name: 'Daylight',
    description: 'A light theme for bright rooms.',
    overrides: {
      void: '#f3f5f9', hull: '#e8ecf3', hullRaised: '#ffffff', glassTint: '#ffffff', metalLight: '#9aa7bd', metalDark: '#d5dbe7',
      neonGreen: '#0a9d4f', neonCyan: '#0077c2', neonViolet: '#7a3fd1', neonAmber: '#b87400', neonRed: '#d12a55',
      text: '#14202e', textDim: '#5b6b80', titlebarTop: '#ffffff', titlebarBottom: '#dfe5ef', menubarTop: '#f1f4f9', menubarBottom: '#e3e8f1',
      editorBackground: '#ffffff', editorLineHighlight: '#eef2f8', editorLineNumber: '#9aa7bd', editorComment: '#7a8aa0',
      gridWall: '#aab5c8', glassAlpha: '0.9',
    },
  },
  {
    name: 'Ember',
    description: 'Warm orange and red on charcoal.',
    overrides: {
      void: '#0a0605', hull: '#120b08', hullRaised: '#1d1210', glassTint: '#1a0f0c', metalLight: '#8a5a3a', metalDark: '#2a1a12',
      neonGreen: '#9be564', neonCyan: '#ffb347', neonViolet: '#ff6b3d', neonAmber: '#ffd166', neonRed: '#ff3d3d',
      text: '#fbeee3', textDim: '#a58a76', titlebarTop: '#2a1a12', titlebarBottom: '#120b08', menubarTop: '#1d1210', menubarBottom: '#0e0807',
      editorBackground: '#0d0807', editorLineHighlight: '#24150f', editorLineNumber: '#7a5a46', editorComment: '#8f735f',
    },
  },
]

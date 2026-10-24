import { luminance, normalizeHex } from './colors'
import { resolveToken, type ThemeOverrides } from './applyTheme'

export interface MonacoThemeData {
  base: 'vs' | 'vs-dark'
  inherit: boolean
  rules: Array<{ token: string; foreground?: string; fontStyle?: string }>
  colors: Record<string, string>
}

const bare = (hex: string) => hex.replace('#', '')

/** Hex colour with a two-digit alpha suffix, which is what Monaco expects for translucent colours. */
function withAlpha(hex: string, alpha: number): string {
  const channel = Math.round(Math.min(1, Math.max(0, alpha)) * 255).toString(16).padStart(2, '0')
  return `${normalizeHex(hex) ?? '#000000'}${channel}`
}

/** Builds the editor's colour theme from the current theme tokens. */
export function buildMonacoTheme(overrides: ThemeOverrides): MonacoThemeData {
  const pick = (id: string) => resolveToken(id, overrides)
  const background = pick('editorBackground')
  return {
    base: luminance(background) < 0.5 ? 'vs-dark' : 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: bare(pick('editorComment')), fontStyle: 'italic' },
      { token: 'keyword', foreground: bare(pick('editorKeyword')), fontStyle: 'bold' },
      { token: 'string', foreground: bare(pick('editorString')) },
      { token: 'number', foreground: bare(pick('editorNumber')) },
      { token: 'identifier', foreground: bare(pick('editorText')) },
      { token: 'delimiter', foreground: bare(pick('editorOperator')) },
      { token: 'type.identifier', foreground: bare(pick('editorOperator')) },
    ],
    colors: {
      'editor.background': background,
      'editor.foreground': pick('editorText'),
      'editor.lineHighlightBackground': pick('editorLineHighlight'),
      'editor.selectionBackground': withAlpha(pick('editorSelection'), 0.27),
      'editorCursor.foreground': pick('editorCursor'),
      'editorLineNumber.foreground': pick('editorLineNumber'),
      'editorLineNumber.activeForeground': pick('editorLineNumberActive'),
      'editorIndentGuide.background1': withAlpha(pick('editorLineNumber'), 0.35),
      'editorIndentGuide.activeBackground1': withAlpha(pick('editorLineNumberActive'), 0.4),
      'editorGutter.background': background,
      'scrollbarSlider.background': withAlpha(pick('editorLineNumberActive'), 0.2),
      'scrollbarSlider.hoverBackground': withAlpha(pick('editorLineNumberActive'), 0.4),
    },
  }
}

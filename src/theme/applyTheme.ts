import { hexToHue, hexToRgbTriplet, hueDistance, isHexColor, normalizeHex } from './colors'
import { ACCENT_TOKEN_IDS, THEME_TOKENS, TOKEN_BY_ID, type ThemeToken } from './tokens'

export type ThemeOverrides = Record<string, string>

/** Accepts only values a token can safely hold; anything else is dropped. */
export function sanitizeTokenValue(token: ThemeToken, raw: unknown): string | null {
  if (typeof raw === 'string' || typeof raw === 'number') {
    const text = String(raw).trim()
    if (token.kind === 'color') return normalizeHex(text)
    if (token.kind === 'number') {
      const value = Number(text)
      if (!Number.isFinite(value)) return null
      const clamped = Math.min(token.max ?? value, Math.max(token.min ?? value, value))
      return String(Math.round(clamped * 1000) / 1000)
    }
    // Font stacks: a list of names, quotes and commas only, so a value can never close the CSS declaration.
    if (text.length > 0 && text.length <= 200 && /^[A-Za-z0-9 ,'"._-]+$/.test(text)) return text
  }
  return null
}

export function sanitizeOverrides(input: unknown): ThemeOverrides {
  const clean: ThemeOverrides = {}
  if (typeof input !== 'object' || input === null) return clean
  for (const [id, raw] of Object.entries(input as Record<string, unknown>)) {
    const token = TOKEN_BY_ID.get(id)
    const value = token ? sanitizeTokenValue(token, raw) : null
    if (token && value !== null) clean[id] = value
  }
  return clean
}

/** The value a token currently has: the student's, else what it follows, else its default. */
export function resolveToken(id: string, overrides: ThemeOverrides): string {
  const token = TOKEN_BY_ID.get(id)
  if (!token) return '#000000'
  if (overrides[id] !== undefined) return overrides[id]
  return token.fallbackOf ? resolveToken(token.fallbackOf, overrides) : token.defaultValue
}

function cssValue(token: ThemeToken, value: string): string {
  if (token.kind === 'number') return `${value}${token.unit ?? ''}`
  if (token.tripletOnly) return hexToRgbTriplet(value)
  return value
}

/** Writes every override onto the root element and removes the properties of tokens that are not overridden. */
export function applyThemeOverrides(root: HTMLElement, overrides: ThemeOverrides): void {
  for (const token of THEME_TOKENS) {
    const value = overrides[token.id]
    if (value === undefined) {
      root.style.removeProperty(token.cssVar)
      if (token.rgbVar) root.style.removeProperty(token.rgbVar)
      continue
    }
    root.style.setProperty(token.cssVar, cssValue(token, value))
    if (token.rgbVar && isHexColor(value)) root.style.setProperty(token.rgbVar, hexToRgbTriplet(value))
  }
}

export function toCssText(overrides: ThemeOverrides): string {
  const lines = THEME_TOKENS.filter((token) => overrides[token.id] !== undefined).map((token) => {
    const value = overrides[token.id]
    const lines = [`  ${token.cssVar}: ${cssValue(token, value)};`]
    if (token.rgbVar && isHexColor(value)) lines.push(`  ${token.rgbVar}: ${hexToRgbTriplet(value)};`)
    return lines.join('\n')
  })
  return `:root {\n${lines.join('\n')}\n}\n`
}

// --- accent hues, so particles and level-up screens follow the theme ---------------------------------

const DEFAULT_ACCENT_HUES = { neonGreen: 145, neonCyan: 188, neonViolet: 270, neonAmber: 42, neonRed: 350 } as const
let accentHues: Record<string, number> = { ...DEFAULT_ACCENT_HUES }

export function updateAccentHues(overrides: ThemeOverrides): void {
  accentHues = Object.fromEntries(ACCENT_TOKEN_IDS.map((id) => [id, hexToHue(resolveToken(id, overrides))]))
}

/** Maps one of the app's built-in effect hues onto the matching accent of the current theme. */
export function themedHue(builtInHue: number): number {
  let nearest: keyof typeof DEFAULT_ACCENT_HUES = 'neonCyan'
  let best = Infinity
  for (const id of ACCENT_TOKEN_IDS) {
    const distance = hueDistance(builtInHue, DEFAULT_ACCENT_HUES[id])
    if (distance < best) {
      best = distance
      nearest = id
    }
  }
  return accentHues[nearest]
}

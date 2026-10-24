import { sanitizeOverrides, type ThemeOverrides } from './applyTheme'
import { hexToHue, hexToSaturation, hueDistance, luminance, mixHex, normalizeHex } from './colors'
import { THEME_TOKENS } from './tokens'

export interface ImportedTheme {
  name: string
  overrides: ThemeOverrides
  /** Plain-language notes about how the input was interpreted. */
  notes: string[]
}

const clean = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Names other colour tools commonly use, mapped to this app's tokens. */
const ALIASES: Record<string, string> = {
  background: 'void', bg: 'void', base: 'void', backgroundcolor: 'void', canvas: 'void', page: 'void',
  surface: 'hull', panel: 'hull', card: 'hull', paper: 'hull', surface1: 'hull',
  surface2: 'hullRaised', elevated: 'hullRaised', overlay: 'hullRaised', surfacevariant: 'hullRaised', raised: 'hullRaised',
  text: 'text', foreground: 'text', fg: 'text', onbackground: 'text', textprimary: 'text', onsurface: 'text',
  muted: 'textDim', subtle: 'textDim', textsecondary: 'textDim', dim: 'textDim', secondarytext: 'textDim',
  primary: 'neonCyan', info: 'neonCyan', cyan: 'neonCyan', blue: 'neonCyan', link: 'neonCyan',
  secondary: 'neonViolet', violet: 'neonViolet', purple: 'neonViolet', magenta: 'neonViolet', pink: 'neonViolet',
  accent: 'neonGreen', tertiary: 'neonGreen', success: 'neonGreen', positive: 'neonGreen', green: 'neonGreen',
  warning: 'neonAmber', caution: 'neonAmber', yellow: 'neonAmber', orange: 'neonAmber', amber: 'neonAmber',
  danger: 'neonRed', error: 'neonRed', negative: 'neonRed', red: 'neonRed',
}

const TOKEN_KEYS = new Map<string, string>()
for (const token of THEME_TOKENS) {
  TOKEN_KEYS.set(clean(token.id), token.id)
  TOKEN_KEYS.set(clean(token.cssVar), token.id)
}

function lookupToken(key: string): string | undefined {
  const normalized = clean(key)
  return TOKEN_KEYS.get(normalized) ?? ALIASES[normalized]
}

/** Fills in the colours a short palette does not mention so the whole app still looks coherent. */
export function deriveDependents(overrides: ThemeOverrides): ThemeOverrides {
  const result = { ...overrides }
  const set = (id: string, value: string | undefined) => {
    if (value !== undefined && result[id] === undefined) result[id] = value
  }
  const base = result.void
  const surface = result.hull ?? (base && result.text ? mixHex(base, result.text, 0.05) : undefined)
  const ink = result.text
  if (base) {
    set('hull', surface)
    set('hullRaised', ink ? mixHex(base, ink, 0.1) : undefined)
    set('glassTint', surface ?? base)
    set('editorBackground', mixHex(base, surface ?? base, 0.6))
    set('editorLineHighlight', ink ? mixHex(base, ink, 0.08) : undefined)
    set('menubarTop', surface)
    set('menubarBottom', base)
    set('titlebarTop', ink ? mixHex(surface ?? base, ink, 0.1) : surface)
    set('titlebarBottom', surface ?? base)
    set('metalDark', surface)
    set('metalLight', ink ? mixHex(base, ink, 0.35) : undefined)
    set('gridWall', ink ? mixHex(base, ink, 0.2) : undefined)
  }
  if (ink && base) {
    set('editorLineNumber', mixHex(base, ink, 0.3))
    set('editorComment', mixHex(base, ink, 0.45))
  }
  return result
}

/** Turns an unordered list of colours into a full set of overrides by brightness and hue. */
export function paletteToOverrides(colors: string[]): ThemeOverrides {
  const unique = [...new Set(colors.map((value) => normalizeHex(value)).filter((value): value is string => value !== null))]
  const overrides: ThemeOverrides = {}
  if (unique.length === 0) return overrides
  const byBrightness = [...unique].sort((a, b) => luminance(a) - luminance(b))
  // A palette with a really dark colour is a dark theme; otherwise the brightest colour is the page.
  const isDarkTheme = luminance(byBrightness[0]) < 0.25
  const ordered = isDarkTheme ? byBrightness : [...byBrightness].reverse()
  overrides.void = ordered[0]
  const remaining = ordered.slice(1)
  // Text is the strongest-contrast colour that is not strongly coloured; fall back to the strongest of all.
  const contrastFirst = [...remaining].reverse()
  const textCandidate = contrastFirst.find((value) => hexToSaturation(value) < 0.35) ?? contrastFirst[0]
  if (textCandidate) {
    overrides.text = textCandidate
    remaining.splice(remaining.indexOf(textCandidate), 1)
  }
  const surfaceCandidate = remaining.find((value) => hexToSaturation(value) < 0.6) ?? remaining[0]
  if (surfaceCandidate && luminance(surfaceCandidate) < 0.5 === isDarkTheme) {
    overrides.hull = surfaceCandidate
    remaining.splice(remaining.indexOf(surfaceCandidate), 1)
  }

  const accents: Array<[string, number]> = [['neonGreen', 145], ['neonCyan', 188], ['neonViolet', 275], ['neonAmber', 42], ['neonRed', 355]]
  const pool = remaining.filter((value) => hexToSaturation(value) > 0.15).sort((a, b) => hexToSaturation(b) * luminance(b) - hexToSaturation(a) * luminance(a))
  const gray = remaining.filter((value) => hexToSaturation(value) <= 0.15)
  if (gray.length > 0) overrides.textDim = gray[gray.length - 1]
  while (pool.length > 0 && accents.length > 0) {
    // Repeatedly give the most fitting (colour, accent) pair its match.
    let bestPool = 0
    let bestAccent = 0
    let bestDistance = Infinity
    pool.forEach((value, poolIndex) =>
      accents.forEach(([, hue], accentIndex) => {
        // Closest hue wins; among near-equal hues the more vivid colour gets the accent.
        const distance = hueDistance(hexToHue(value), hue) - 20 * hexToSaturation(value) * luminance(value)
        if (distance < bestDistance) {
          bestDistance = distance
          bestPool = poolIndex
          bestAccent = accentIndex
        }
      }),
    )
    overrides[accents[bestAccent][0]] = pool[bestPool]
    pool.splice(bestPool, 1)
    accents.splice(bestAccent, 1)
  }
  return deriveDependents(overrides)
}

function themeFromObject(source: Record<string, unknown>, notes: string[]): ThemeOverrides {
  const overrides: ThemeOverrides = {}
  const visit = (value: unknown, depth: number) => {
    if (typeof value !== 'object' || value === null || depth > 3) return
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (typeof entry === 'object' && entry !== null && !Array.isArray(entry)) {
        visit(entry, depth + 1)
        continue
      }
      const tokenId = lookupToken(key)
      if (tokenId && typeof entry === 'string' && normalizeHex(entry)) overrides[tokenId] = normalizeHex(entry) as string
      else if (tokenId && typeof entry === 'number') overrides[tokenId] = String(entry)
      else if (tokenId && typeof entry === 'string' && /^[\d.]+$/.test(entry)) overrides[tokenId] = entry
    }
  }
  visit(source, 0)
  if (Object.keys(overrides).length > 0) notes.push(`Matched ${Object.keys(overrides).length} named colours.`)
  return overrides
}

function parseParams(params: URLSearchParams, notes: string[]): { name: string; overrides: ThemeOverrides } | null {
  const name = params.get('name') ?? params.get('theme-name') ?? 'Imported theme'
  const packed = params.get('theme') ?? params.get('t') ?? params.get('data')
  if (packed) {
    const decoded = tryJson(packed) ?? tryJson(base64Decode(packed))
    if (decoded) {
      const parsed = fromAny(decoded, notes)
      if (parsed) return { name: parsed.name === 'Imported theme' ? name : parsed.name, overrides: parsed.overrides }
    }
  }
  const palette = params.get('colors') ?? params.get('palette') ?? params.get('c')
  if (palette) {
    notes.push('Read a colour list from the link and assigned colours by brightness and hue.')
    return { name, overrides: paletteToOverrides(palette.split(/[-,;\s|]+/)) }
  }
  const named: Record<string, string> = {}
  params.forEach((value, key) => {
    if (normalizeHex(value) && (lookupToken(key) !== undefined)) named[key] = value
  })
  if (Object.keys(named).length > 0) return { name, overrides: deriveDependents(themeFromObject(named, notes)) }
  return null
}

function tryJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function base64Decode(text: string): string {
  try {
    const padded = text.replace(/-/g, '+').replace(/_/g, '/')
    return decodeURIComponent(escape(atob(padded)))
  } catch {
    return ''
  }
}

function fromAny(value: unknown, notes: string[]): { name: string; overrides: ThemeOverrides } | null {
  if (Array.isArray(value)) {
    const colors = value.filter((entry): entry is string => typeof entry === 'string')
    if (colors.length === 0) return null
    notes.push('Read a list of colours and assigned them by brightness and hue.')
    return { name: 'Imported palette', overrides: paletteToOverrides(colors) }
  }
  if (typeof value === 'object' && value !== null) {
    const source = value as Record<string, unknown>
    const name = typeof source.name === 'string' && source.name.trim() ? source.name.trim().slice(0, 60) : 'Imported theme'
    const direct = sanitizeOverrides(source.overrides ?? source.tokens ?? undefined)
    if (Object.keys(direct).length > 0) return { name, overrides: direct }
    const named = themeFromObject(source, notes)
    if (Object.keys(named).length > 0) return { name, overrides: deriveDependents(named) }
    for (const key of ['palette', 'colors', 'swatches']) {
      const inner = source[key]
      if (Array.isArray(inner)) return fromAny(inner, notes) && { name, overrides: fromAny(inner, notes)!.overrides }
    }
  }
  return null
}

function fromCss(text: string, notes: string[]): ThemeOverrides {
  const found: Record<string, string> = {}
  for (const match of text.matchAll(/--([a-z0-9_-]+)\s*:\s*([^;}\n]+)/gi)) found[match[1]] = match[2].trim()
  const overrides = themeFromObject(found, notes)
  return Object.keys(overrides).length > 0 ? deriveDependents(overrides) : {}
}

/** Reads whatever a colour tool produced: JSON, CSS variables, a share link, or a plain list of hex colours. */
export function parseThemeInput(input: string): ImportedTheme | null {
  const text = input.trim()
  if (!text) return null
  const notes: string[] = []

  if (/^https?:\/\//i.test(text) || /^[^\s{[]*[?#][^\s]*=/.test(text)) {
    try {
      const url = new URL(text, 'https://example.invalid/')
      const fromQuery = parseParams(url.searchParams, notes)
      const hashParams = new URLSearchParams(url.hash.replace(/^#\/?\??/, ''))
      const parsed = fromQuery ?? parseParams(hashParams, notes)
      if (parsed && Object.keys(parsed.overrides).length > 0) return { ...parsed, notes }
      const pathColors = url.pathname.split(/[-/,]+/).filter((part) => normalizeHex(part) !== null)
      if (pathColors.length >= 2) {
        notes.push('Read the colours from the link address.')
        return { name: 'Imported from link', overrides: paletteToOverrides(pathColors), notes }
      }
    } catch {
      // Fall through to the other formats.
    }
  }

  if (text.startsWith('{') || text.startsWith('[')) {
    const decoded = tryJson(text)
    const parsed = decoded ? fromAny(decoded, notes) : null
    if (parsed && Object.keys(parsed.overrides).length > 0) return { ...parsed, notes }
  }

  const cssOverrides = fromCss(text, notes)
  if (Object.keys(cssOverrides).length > 0) return { name: 'Imported CSS theme', overrides: cssOverrides, notes }

  const hexColors = [...text.matchAll(/#?\b([0-9a-f]{6}|[0-9a-f]{3})\b/gi)].map((match) => `#${match[1]}`)
  if (hexColors.length >= 2) {
    notes.push('Read a list of colours and assigned them by brightness and hue.')
    return { name: 'Imported palette', overrides: paletteToOverrides(hexColors), notes }
  }
  return null
}

import { describe, expect, it } from 'vitest'
import { resolveToken, sanitizeOverrides, sanitizeTokenValue, toCssText } from './applyTheme'
import { hexToRgbTriplet, normalizeHex } from './colors'
import { parseThemeInput } from './importTheme'
import { buildMonacoTheme } from './monacoTheme'
import { THEME_PRESETS } from './presets'
import { THEME_TOKENS, TOKEN_BY_ID } from './tokens'

describe('colours', () => {
  it('normalizes hex forms', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc')
    expect(normalizeHex('19E6FF')).toBe('#19e6ff')
    expect(normalizeHex('red; background:url(x)')).toBeNull()
  })
  it('makes space separated triplets', () => {
    expect(hexToRgbTriplet('#19e6ff')).toBe('25 230 255')
  })
})

describe('tokens', () => {
  it('has unique ids and css variables, and every fallback exists', () => {
    expect(new Set(THEME_TOKENS.map((token) => token.id)).size).toBe(THEME_TOKENS.length)
    expect(new Set(THEME_TOKENS.map((token) => token.cssVar)).size).toBe(THEME_TOKENS.length)
    for (const token of THEME_TOKENS) if (token.fallbackOf) expect(TOKEN_BY_ID.has(token.fallbackOf)).toBe(true)
  })
  it('follows the accent a token falls back to until it is overridden', () => {
    expect(resolveToken('editorKeyword', {})).toBe('#a45cff')
    expect(resolveToken('editorKeyword', { neonViolet: '#ff00ff' })).toBe('#ff00ff')
    expect(resolveToken('editorKeyword', { neonViolet: '#ff00ff', editorKeyword: '#00ff00' })).toBe('#00ff00')
  })
  it('every preset only uses real tokens with valid values', () => {
    for (const preset of THEME_PRESETS) expect(sanitizeOverrides(preset.overrides)).toEqual(preset.overrides)
  })
})

describe('sanitizing', () => {
  it('rejects values that could break out of a CSS declaration', () => {
    expect(sanitizeTokenValue(TOKEN_BY_ID.get('fontUi')!, 'x; background: red')).toBeNull()
    expect(sanitizeTokenValue(TOKEN_BY_ID.get('text')!, 'url(http://x)')).toBeNull()
    expect(sanitizeTokenValue(TOKEN_BY_ID.get('fontUi')!, "'Fira Code', monospace")).toBe("'Fira Code', monospace")
  })
  it('clamps numbers and drops unknown tokens', () => {
    expect(sanitizeTokenValue(TOKEN_BY_ID.get('cut')!, '999')).toBe('28')
    expect(sanitizeOverrides({ nope: '#ffffff', text: '#fff' })).toEqual({ text: '#ffffff' })
  })
  it('writes css text', () => {
    expect(toCssText({ neonCyan: '#00ffff' })).toContain('--neon-cyan-rgb: 0 255 255;')
  })
})

describe('importing', () => {
  it('reads CSS variables by name or alias', () => {
    const parsed = parseThemeInput(':root { --background: #101820; --primary: #00e5ff; --text: #eeeeee }')
    expect(parsed?.overrides.void).toBe('#101820')
    expect(parsed?.overrides.neonCyan).toBe('#00e5ff')
    expect(parsed?.overrides.text).toBe('#eeeeee')
  })
  it('reads this app\'s own export', () => {
    const exported = JSON.stringify({ name: 'Mine', overrides: { neonGreen: '#00ff00' } })
    expect(parseThemeInput(exported)).toMatchObject({ name: 'Mine', overrides: { neonGreen: '#00ff00' } })
  })
  it('reads a share link', () => {
    const packed = btoa(JSON.stringify({ name: 'Linked', overrides: { neonRed: '#ff0000' } }))
    expect(parseThemeInput(`https://example.com/?theme=${packed}`)?.overrides.neonRed).toBe('#ff0000')
  })
  it('turns a plain list of hex colours into a full dark theme', () => {
    const parsed = parseThemeInput('#0b0c10 #1f2833 #c5c6c7 #66fcf1 #45a29e')
    expect(parsed?.overrides.void).toBe('#0b0c10')
    expect(parsed?.overrides.text).toBe('#c5c6c7')
    expect(parsed?.overrides.hull).toBe('#1f2833')
    expect(parsed?.overrides.neonCyan).toBe('#66fcf1')
    expect(Object.keys(parsed!.overrides)).toContain('editorBackground')
  })
  it('reads a palette from a link query', () => {
    expect(parseThemeInput('https://x.test/?colors=0b0c10-1f2833-66fcf1')?.overrides.void).toBe('#0b0c10')
  })
  it('returns null for text with no colours', () => {
    expect(parseThemeInput('hello world')).toBeNull()
    expect(parseThemeInput('')).toBeNull()
  })
})

describe('editor theme', () => {
  it('uses the light base for light backgrounds', () => {
    expect(buildMonacoTheme({}).base).toBe('vs-dark')
    expect(buildMonacoTheme({ editorBackground: '#ffffff' }).base).toBe('vs')
  })
  it('follows accent changes', () => {
    expect(buildMonacoTheme({ neonViolet: '#ff00ff' }).rules.find((rule) => rule.token === 'keyword')?.foreground).toBe('ff00ff')
  })
})

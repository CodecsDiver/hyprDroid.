export interface AppCommand {
  id: string
  title: string
  category: 'File' | 'Edit' | 'View' | 'Run' | 'Go' | 'Help'
  /** First entry is shown in menus; all entries trigger the command. */
  shortcuts?: string[]
  /** When true the focused editor already handles the shortcut, so the global handler must not. */
  handledByEditor?: boolean
  run: () => unknown
  isEnabled?: () => boolean
  isChecked?: () => boolean
}

interface ParsedShortcut {
  ctrl: boolean
  shift: boolean
  alt: boolean
  key: string
}

export function parseShortcut(shortcut: string): ParsedShortcut {
  const parts = shortcut.split('+')
  const key = parts[parts.length - 1] === '' ? '+' : parts[parts.length - 1]
  const modifiers = new Set(parts.slice(0, -1).map((part) => part.toLowerCase()))
  return { ctrl: modifiers.has('ctrl'), shift: modifiers.has('shift'), alt: modifiers.has('alt'), key: key.toLowerCase() }
}

export interface KeyLike {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
}

export function matchesShortcut(event: KeyLike, shortcut: string): boolean {
  const wanted = parseShortcut(shortcut)
  const hasCommandKey = event.ctrlKey || event.metaKey
  if (wanted.ctrl !== hasCommandKey || wanted.alt !== event.altKey) return false
  const key = event.key.toLowerCase()
  // Shift is implied by symbols such as '+' and '?', so only check it for letters, digits and named keys.
  const isSymbol = key.length === 1 && !/[a-z0-9]/.test(key)
  if (!isSymbol && wanted.shift !== event.shiftKey) return false
  return key === wanted.key
}

export function formatShortcut(shortcut: string): string {
  return shortcut
}

/**
 * Subsequence match with bonuses for consecutive characters and word starts.
 * Returns -1 when the query does not match, higher is better.
 */
export function fuzzyScore(query: string, text: string): number {
  const needle = query.trim().toLowerCase()
  if (needle === '') return 0
  const haystack = text.toLowerCase()
  let score = 0
  let position = 0
  let previousMatch = -2
  for (const character of needle) {
    if (character === ' ') continue
    const found = haystack.indexOf(character, position)
    if (found === -1) return -1
    score += 1
    if (found === previousMatch + 1) score += 3
    if (found === 0 || /[\s:._/-]/.test(haystack[found - 1])) score += 4
    previousMatch = found
    position = found + 1
  }
  return score - haystack.length * 0.01
}

export function searchCommands(commands: AppCommand[], query: string): AppCommand[] {
  return commands
    .map((command) => ({ command, score: fuzzyScore(query, `${command.category}: ${command.title}`) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.command)
}

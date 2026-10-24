import { MAIN_FILE_NAME } from './projects'

export const MAX_FILES_PER_PROJECT = 20
export const RESERVED_FILE_NAME = '_checks.py'
/** Files the app writes into a project folder itself; they are never shown as the student's files. */
export const RESERVED_FILE_NAMES: readonly string[] = [RESERVED_FILE_NAME, 'trace_runner.py']
const STEM_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

/** What the student typed becomes a .py file name: "helpers" -> "helpers.py". */
export function normalizeNewFileName(input: string): string {
  const trimmed = input.trim()
  return trimmed.endsWith('.py') ? trimmed : `${trimmed}.py`
}

/** Returns a message the student can act on, or null when the name is fine. Mirrors the Rust rules. */
export function validateNewFileName(input: string, existingNames: readonly string[]): string | null {
  if (input.trim() === '') return 'Type a file name, for example helpers.py'
  const name = normalizeNewFileName(input)
  const stem = name.slice(0, -'.py'.length)
  if (stem === '' || !STEM_PATTERN.test(stem)) {
    return 'Use letters, digits and underscores only, starting with a letter or underscore (no spaces, dots or slashes)'
  }
  if (stem.length > 64) return 'That name is too long (64 characters at most)'
  if (RESERVED_FILE_NAMES.includes(name)) return `${name} is reserved for the app`
  if (existingNames.includes(name)) return `${name} already exists`
  if (existingNames.length >= MAX_FILES_PER_PROJECT) return `A mission can have ${MAX_FILES_PER_PROJECT} files at most`
  return null
}

/** main.py first, then the rest alphabetically. */
export function sortFileNames(names: readonly string[]): string[] {
  return [...new Set(names)].sort((a, b) => (a === MAIN_FILE_NAME ? -1 : b === MAIN_FILE_NAME ? 1 : a.localeCompare(b)))
}

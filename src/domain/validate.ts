/** Small, dependency-free validation helpers. Limits mirror the database CHECK constraints. */

export class ValidationError extends Error {
  readonly field: string
  constructor(field: string, message: string) {
    super(message)
    this.name = 'ValidationError'
    this.field = field
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i
export const OBJECT_ID_PATTERN = /^[a-z][a-z0-9_]{1,62}$/

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR_PATTERN.test(value)
}

/** Length in Unicode code points, matching Postgres char_length (JS .length counts UTF-16 units). */
export function charLength(value: string): number {
  let count = 0
  for (const _ of value) count++
  return count
}

// Strip control characters except newline/tab; keeps emoji and every script intact.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

export interface TextRules {
  max: number
  min?: number
  required?: boolean
}

/** Trims and validates user text. Returns '' (or throws when required) for empty input. */
export function cleanText(value: unknown, field: string, rules: TextRules): string {
  if (value === undefined || value === null) value = ''
  if (typeof value !== 'string') throw new ValidationError(field, `${field} must be text`)
  const text = value.replace(CONTROL_CHARS, '').trim()
  const length = charLength(text)
  if (length === 0) {
    if (rules.required) throw new ValidationError(field, `${field} is required`)
    return ''
  }
  if (length < (rules.min ?? 1)) throw new ValidationError(field, `${field} is too short`)
  if (length > rules.max) throw new ValidationError(field, `${field} must be at most ${rules.max} characters`)
  return text
}

export function pickEnum<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) return value as T
  throw new ValidationError(field, `${field} is not a recognised option`)
}

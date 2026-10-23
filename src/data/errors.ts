/** Maps API error codes and network failures onto stable, user-presentable errors. */

export type ErrorCode =
  | 'not_authenticated' | 'no_partner' | 'invalid_payload' | 'invalid_kind' | 'invalid_mood' | 'rate_limited'
  | 'recipient_declined' | 'consent_required' | 'not_found' | 'limit_reached' | 'permission' | 'validation'
  | 'invalid_credentials' | 'locked' | 'too_large' | 'conflict' | 'immutable' | 'server_not_configured' | 'csrf'
  | 'network' | 'unknown'

const KNOWN_CODES: ReadonlySet<string> = new Set<ErrorCode>([
  'not_authenticated', 'no_partner', 'invalid_payload', 'invalid_kind', 'invalid_mood', 'rate_limited',
  'recipient_declined', 'consent_required', 'not_found', 'limit_reached', 'invalid_credentials', 'locked', 'too_large', 'conflict', 'immutable',
  'server_not_configured', 'csrf', 'permission',
])

const USER_MESSAGES: Record<ErrorCode, string> = {
  not_authenticated: 'Please sign in again.',
  no_partner: 'Your partner is not available right now.',
  invalid_payload: 'That message could not be sent because something in it is not valid.',
  invalid_kind: 'That kind of message is not supported.',
  invalid_mood: 'That mood is not available.',
  rate_limited: 'Slow down a little — too many messages at once.',
  recipient_declined: 'They have not turned that on. Mischief only works when both of you opt in.',
  consent_required: 'Both of you need to opt in to listening together first.',
  not_found: 'That item could not be found.',
  limit_reached: 'You have reached the limit for this.',
  permission: 'You do not have permission to do that.',
  validation: 'Please check what you entered.',
  invalid_credentials: 'That name and password do not match.',
  locked: 'Too many attempts. Please wait a few minutes and try again.',
  too_large: 'That is too large.',
  conflict: 'Something changed at the same moment. Please try again.',
  immutable: 'Archived items can never be changed.',
  server_not_configured: 'The server has not been set up yet.',
  csrf: 'The request was blocked for your safety. Reload the page and try again.',
  network: 'You appear to be offline. We will keep trying.',
  unknown: 'Something went wrong. Please try again.',
}

/** Errors that will never succeed on retry. */
const PERMANENT: ReadonlySet<ErrorCode> = new Set<ErrorCode>([
  'invalid_payload', 'invalid_kind', 'recipient_declined', 'no_partner', 'permission', 'validation',
])

export class AppError extends Error {
  readonly code: ErrorCode
  readonly retryable: boolean
  readonly userMessage: string

  constructor(code: ErrorCode, message?: string, options?: { cause?: unknown }) {
    super(message ?? code, options)
    this.name = 'AppError'
    this.code = code
    this.retryable = !PERMANENT.has(code) && code !== 'validation'
    this.userMessage = USER_MESSAGES[code]
  }
}

interface ErrorLike {
  message?: unknown
  code?: unknown
  name?: unknown
  status?: unknown
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error
  const e = (typeof error === 'object' && error !== null ? error : {}) as ErrorLike
  const message = typeof e.message === 'string' ? e.message : String(error ?? '')

  if (KNOWN_CODES.has(message)) return new AppError(message as ErrorCode, message, { cause: error })
  if (e.code === '42501' || /row-level security|permission denied/i.test(message)) return new AppError('permission', message, { cause: error })
  if (e.name === 'ValidationError') return new AppError('validation', message, { cause: error })
  if (
    e.name === 'AuthRetryableFetchError' ||
    /failed to fetch|networkerror|network request failed|load failed|fetch failed|timeout/i.test(message) ||
    (typeof navigator !== 'undefined' && navigator.onLine === false)
  ) {
    return new AppError('network', message, { cause: error })
  }
  if (typeof e.status === 'number' && e.status >= 500) return new AppError('network', message, { cause: error })
  return new AppError('unknown', message, { cause: error })
}

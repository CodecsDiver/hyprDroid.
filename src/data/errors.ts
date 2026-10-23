/** Maps Postgres/PostgREST/network failures onto stable, user-presentable errors. */

export type ErrorCode =
  | 'not_authenticated' | 'not_in_household' | 'no_partner' | 'invalid_payload' | 'invalid_kind' | 'invalid_mood'
  | 'rate_limited' | 'recipient_declined' | 'consent_required' | 'invalid_invite' | 'invalid_email' | 'invalid_name'
  | 'household_full' | 'already_in_household' | 'not_found' | 'limit_reached' | 'permission' | 'validation'
  | 'network' | 'unknown'

const KNOWN_CODES: ReadonlySet<string> = new Set<ErrorCode>([
  'not_authenticated', 'not_in_household', 'no_partner', 'invalid_payload', 'invalid_kind', 'invalid_mood', 'rate_limited',
  'recipient_declined', 'consent_required', 'invalid_invite', 'invalid_email', 'invalid_name', 'household_full',
  'already_in_household', 'not_found', 'limit_reached',
])

const USER_MESSAGES: Record<ErrorCode, string> = {
  not_authenticated: 'Please sign in again.',
  not_in_household: 'Join or create your household first.',
  no_partner: 'Your partner has not joined the household yet.',
  invalid_payload: 'That message could not be sent because something in it is not valid.',
  invalid_kind: 'That kind of message is not supported.',
  invalid_mood: 'That mood is not available.',
  rate_limited: 'Slow down a little — too many messages at once.',
  recipient_declined: 'They have not turned that on. Mischief only works when both of you opt in.',
  consent_required: 'Both of you need to opt in to listening together first.',
  invalid_invite: 'This invite is not valid for the account you are signed in with, or it has expired.',
  invalid_email: 'That email address does not look right.',
  invalid_name: 'Please enter a name between 1 and 60 characters.',
  household_full: 'This household already has two people.',
  already_in_household: 'This account already belongs to a household.',
  not_found: 'That item could not be found.',
  limit_reached: 'You have reached the limit for this.',
  permission: 'You do not have permission to do that.',
  validation: 'Please check what you entered.',
  network: 'You appear to be offline. We will keep trying.',
  unknown: 'Something went wrong. Please try again.',
}

/** Errors that will never succeed on retry. */
const PERMANENT: ReadonlySet<ErrorCode> = new Set<ErrorCode>([
  'invalid_payload', 'invalid_kind', 'recipient_declined', 'no_partner', 'not_in_household', 'permission', 'validation',
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

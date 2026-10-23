import { toAppError } from './errors'

interface Result<T> {
  data: T | null
  error: unknown
}

/** Unwraps a Supabase response, throwing a typed AppError on failure. */
export async function unwrap<T>(pending: PromiseLike<Result<T>>): Promise<T> {
  const { data, error } = await pending
  if (error) throw toAppError(error)
  return data as T
}

export async function unwrapOrNull<T>(pending: PromiseLike<Result<T>>): Promise<T | null> {
  const { data, error } = await pending
  if (error) throw toAppError(error)
  return data ?? null
}

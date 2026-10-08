/** A user-presentable error. `message` is safe to show; `cause` is for logs. */
export class AppError extends Error {
  readonly code: 'network' | 'auth' | 'not_found' | 'conflict' | 'invalid' | 'unknown'

  constructor(code: AppError['code'], message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'AppError'
    this.code = code
  }
}

interface PostgrestLikeError {
  message?: string
  code?: string
  status?: number
}

export const NETWORK_MESSAGE = 'Couldn’t connect. Please try again.'

/** Normalize Supabase/PostgREST/fetch errors into calm, specific messages. */
export function toAppError(error: unknown, fallback = 'Something went wrong. Please try again.'): AppError {
  if (error instanceof AppError) return error
  const e = (error ?? {}) as PostgrestLikeError
  const msg = (e.message ?? '').toLowerCase()

  if ((typeof navigator !== 'undefined' && navigator.onLine === false) || msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('load failed')) {
    return new AppError('network', NETWORK_MESSAGE, { cause: error })
  }
  if (e.status === 401 || e.code === 'PGRST301' || msg.includes('jwt')) {
    return new AppError('auth', 'Your session expired. Please log in again.', { cause: error })
  }
  if (e.code === '23505') return new AppError('conflict', 'That already exists.', { cause: error })
  if (e.code === '23514' || e.code === '22P02') return new AppError('invalid', 'Some of that input isn’t valid.', { cause: error })
  if (e.code === 'PGRST116') return new AppError('not_found', 'We couldn’t find that.', { cause: error })
  return new AppError('unknown', fallback, { cause: error })
}

export function errorMessage(error: unknown): string {
  return toAppError(error).message
}

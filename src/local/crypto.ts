/**
 * Replaces server/crypto.ts in the browser build. There are no passwords, cookies or sessions offline: the app
 * talks to its in-page backend as an "admin acting as" one of the two people, so none of this is ever exercised.
 * It exists only so the shared server code compiles and loads unchanged.
 */
export const PBKDF2_ITERATIONS = 0
export interface TokenPayload {
  u: string
  e: number
}
export const safeEqual = (a: string, b: string): boolean => a === b
export const hashPassword = async (): Promise<string> => 'none'
export const verifyPassword = async (): Promise<boolean> => false
export const signToken = (): string => ''
export const verifyToken = (): TokenPayload | null => null
export const randomHex = (bytes = 32): string => [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('')

import { hashPassword } from './crypto'

export interface ServerUser {
  id: string
  name: string
  passwordHash: string
}

export interface ServerConfig {
  users: ServerUser[]
  sessionSecret: string
  /** Lets the owner's setup script act as either user (uploads originals, seeds content). Null = disabled. */
  adminToken: string | null
}

export type ConfigResult = { ok: true; config: ServerConfig } | { ok: false; problems: string[] }

const USER_ID = /^[a-z0-9][a-z0-9_-]{0,31}$/

/**
 * Reads the server configuration from environment variables:
 *   SIGNAL_USERS           JSON: [{"id":"daniel","name":"Daniel","hash":"pbkdf2$…"},{"id":"vee",…}]
 *   SIGNAL_SESSION_SECRET  ≥ 32 random characters
 *   SIGNAL_ADMIN_TOKEN     optional, ≥ 32 characters
 * `npm run setup:auth` generates all three.
 */
export function loadConfig(env: Record<string, string | undefined>): ConfigResult {
  const problems: string[] = []
  let users: ServerUser[] = []

  if (!env.SIGNAL_USERS) problems.push('SIGNAL_USERS is not set.')
  else {
    try {
      const parsed = JSON.parse(env.SIGNAL_USERS) as { id?: unknown; name?: unknown; hash?: unknown }[]
      if (!Array.isArray(parsed) || parsed.length !== 2) problems.push('SIGNAL_USERS must list exactly two users.')
      else {
        users = parsed.map((user) => ({ id: String(user.id), name: String(user.name ?? user.id), passwordHash: String(user.hash) }))
        for (const user of users) {
          if (!USER_ID.test(user.id)) problems.push(`User id "${user.id}" must be lowercase letters, digits, "-" or "_".`)
          if (!user.passwordHash.startsWith('pbkdf2$')) problems.push(`User "${user.id}" has no valid password hash.`)
          if (user.name.length < 1 || user.name.length > 40) problems.push(`User "${user.id}" needs a name of 1–40 characters.`)
        }
        if (new Set(users.map((u) => u.id)).size !== 2) problems.push('The two user ids must differ.')
      }
    } catch {
      problems.push('SIGNAL_USERS is not valid JSON.')
    }
  }

  const secret = env.SIGNAL_SESSION_SECRET ?? ''
  if (secret.length < 32) problems.push('SIGNAL_SESSION_SECRET must be at least 32 characters.')
  const adminToken = env.SIGNAL_ADMIN_TOKEN ? env.SIGNAL_ADMIN_TOKEN : null
  if (adminToken !== null && adminToken.length < 32) problems.push('SIGNAL_ADMIN_TOKEN must be at least 32 characters (or unset).')

  return problems.length > 0 ? { ok: false, problems } : { ok: true, config: { users, sessionSecret: secret, adminToken } }
}

/** Development convenience ONLY: two users, password "dev". Never used when NODE_ENV=production. */
export async function devConfig(secret: string): Promise<ServerConfig> {
  const hash = await hashPassword('dev', 2000)
  return {
    users: [
      { id: 'daniel', name: 'Daniel', passwordHash: hash },
      { id: 'vee', name: 'Vee', passwordHash: hash },
    ],
    sessionSecret: secret,
    adminToken: `dev-admin-token-${secret}`.slice(0, 64).padEnd(32, '0'),
  }
}

import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'

/**
 * `npm run dev` serves the API from the same process, backed by a folder (./.data). No accounts, no
 * separate server. Without SIGNAL_* variables it creates two development users: "daniel" and "vee",
 * password "dev".
 */
export function signalHomeApi(): Plugin {
  return {
    name: 'signal-home-api',
    apply: 'serve',
    configureServer(server) {
      const dataDir = process.env.DATA_DIR ?? join(process.cwd(), '.data')
      mkdirSync(dataDir, { recursive: true })
      const secretFile = join(dataDir, 'dev-secret')
      if (!existsSync(secretFile)) writeFileSync(secretFile, randomBytes(32).toString('hex'), { mode: 0o600 })
      const secret = readFileSync(secretFile, 'utf8').trim()

      let handler: Promise<(request: Request) => Promise<Response>> | null = null
      server.middlewares.use('/api', async (req, res) => {
        try {
          handler ??= (async () => {
            const { createHandler } = (await server.ssrLoadModule('/server/runtime.ts')) as typeof import('./runtime')
            const { FileStore } = (await server.ssrLoadModule('/server/store.ts')) as typeof import('./store')
            const { devConfig } = (await server.ssrLoadModule('/server/config.ts')) as typeof import('./config')
            return createHandler({ env: process.env, store: new FileStore(join(dataDir, 'store')), devFallback: () => devConfig(secret) })
          })()
          const { respond } = (await server.ssrLoadModule('/server/node-adapter.ts')) as typeof import('./node-adapter')
          await respond(await handler, req, res, `/api${req.url === '/' ? '' : (req.url ?? '')}`)
        } catch (error) {
          handler = null
          console.error('[api]', error)
          res.statusCode = 500
          res.end('{"error":{"code":"internal"}}')
        }
      })
    },
  }
}

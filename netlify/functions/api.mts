/**
 * The whole backend as one Netlify Function (routes under /api/*). Data lives in Netlify Blobs.
 * Configure with the SIGNAL_* environment variables (see docs/SETUP.md).
 */
import { createHandler } from '../../server/runtime'
import { createNetlifyStore } from '../../server/store-netlify'

let handler: ReturnType<typeof createHandler> | null = null

export default async (request: Request): Promise<Response> => {
  handler ??= createHandler({ env: process.env as Record<string, string | undefined>, store: createNetlifyStore() })
  return (await handler)(request)
}

export const config = { path: '/api/*' }

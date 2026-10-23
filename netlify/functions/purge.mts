import { purgeExpired } from '../../server/purge'
import { createNetlifyStore } from '../../server/store-netlify'

/** Hourly housekeeping: removes long-expired events and abandoned uploads. */
export default async (): Promise<Response> => {
  const result = await purgeExpired(createNetlifyStore(), Date.now())
  return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } })
}

export const config = { schedule: '@hourly' }

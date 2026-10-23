import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'

/** Bridges Node's http objects to the fetch-style handler used everywhere else. */
export async function respond(handle: (request: Request) => Promise<Response>, req: IncomingMessage, res: ServerResponse, urlPath = req.url ?? '/'): Promise<void> {
  const headers = new Headers()
  for (const [name, value] of Object.entries(req.headers)) if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value)
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
  const request = new Request(`http://${req.headers.host ?? 'localhost'}${urlPath}`, {
    method: req.method,
    headers,
    ...(hasBody ? { body: Readable.toWeb(req) as unknown as ReadableStream, duplex: 'half' } : {}),
  } as RequestInit)

  const response = await handle(request)
  const out: Record<string, string | string[]> = {}
  response.headers.forEach((value, name) => {
    if (name !== 'set-cookie') out[name] = value
  })
  const cookies = response.headers.getSetCookie()
  if (cookies.length > 0) out['set-cookie'] = cookies
  res.writeHead(response.status, out)
  res.end(Buffer.from(await response.arrayBuffer()))
}

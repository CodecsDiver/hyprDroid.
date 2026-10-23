/** Parser for the Netlify/Cloudflare `_headers` format, shared by the standalone server and the dist checks. */
export interface HeaderRule {
  pattern: string
  headers: Record<string, string>
}

export function parseHeadersFile(text: string): HeaderRule[] {
  const rules: HeaderRule[] = []
  let current: HeaderRule | null = null
  for (const raw of text.split('\n')) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue
    if (!/^\s/.test(raw)) {
      current = { pattern: raw.trim(), headers: {} }
      rules.push(current)
    } else if (current) {
      const i = raw.indexOf(':')
      current.headers[raw.slice(0, i).trim()] = raw.slice(i + 1).trim()
    }
  }
  return rules
}

export function matchesPattern(pattern: string, path: string): boolean {
  return pattern.endsWith('*') ? path.startsWith(pattern.slice(0, -1)) : pattern === path
}

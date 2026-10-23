/** "just now", "5 minutes ago", "yesterday"… for activity lists. */
export function relativeTime(iso: string, nowMs: number = Date.now()): string {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return ''
  const seconds = Math.round((then - nowMs) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 45) return 'just now'
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  if (abs < 3600) return formatter.format(Math.round(seconds / 60), 'minute')
  if (abs < 86_400) return formatter.format(Math.round(seconds / 3600), 'hour')
  if (abs < 604_800) return formatter.format(Math.round(seconds / 86_400), 'day')
  return new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function formatDuration(ms: number | null | undefined): string {
  if (!ms || ms < 0) return '0:00'
  const total = Math.floor(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

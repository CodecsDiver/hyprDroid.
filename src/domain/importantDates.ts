import { dayNumber } from './dailyQuestions'
import type { ImportantDate } from '@/shared/types'

/** Local calendar day (`YYYY-MM-DD`) for a Date. */
export function localDay(now: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

const isLeap = (year: number): boolean => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0

/** The next day (today counts) this date happens, as `YYYY-MM-DD`. A one-off date is always itself, even when past. */
export function nextOccurrence(item: Pick<ImportantDate, 'date' | 'yearly'>, today: string): string {
  if (!item.yearly) return item.date
  const [year, month, day] = item.date.split('-').map(Number) as [number, number, number]
  const todayYear = Number(today.slice(0, 4))
  const on = (y: number): string => {
    const d = month === 2 && day === 29 && !isLeap(y) ? 28 : day // a leap-day date is kept on 28 Feb in other years
    return `${String(y).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  const thisYear = on(Math.max(todayYear, year))
  return thisYear >= today ? thisYear : on(todayYear + 1)
}

/** Whole days from `today` to the next occurrence (negative: it was that many days ago). */
export function daysUntil(item: Pick<ImportantDate, 'date' | 'yearly'>, today: string): number {
  return dayNumber(nextOccurrence(item, today)) - dayNumber(today)
}

export function describeDate(item: ImportantDate, today: string): { when: string; badge: string | null; isToday: boolean } {
  const days = daysUntil(item, today)
  const next = nextOccurrence(item, today)
  const years = Number(next.slice(0, 4)) - Number(item.date.slice(0, 4))
  const badge = item.yearly && years > 0 ? (item.kind === 'birthday' ? `${years} years` : item.kind === 'anniversary' ? `Year ${years}` : null) : null
  if (days === 0) return { when: 'Today', badge, isToday: true }
  if (days === 1) return { when: 'Tomorrow', badge, isToday: false }
  if (days === -1) return { when: 'Yesterday', badge: null, isToday: false }
  if (days > 0) return { when: `in ${days} days`, badge, isToday: false }
  return { when: `${-days} days ago`, badge: null, isToday: false }
}

/** Days since the earliest anniversary (the day you started counting), or null if there is none yet. */
export function daysTogether(dates: readonly ImportantDate[], today: string): { days: number; since: string } | null {
  const first = dates.filter((d) => d.kind === 'anniversary').sort((a, b) => a.date.localeCompare(b.date))[0]
  if (!first || first.date > today) return null
  return { days: dayNumber(today) - dayNumber(first.date), since: first.date }
}

/** Dates sorted with the soonest upcoming first, then the past ones (most recent first). */
export function sortedForDisplay(dates: readonly ImportantDate[], today: string): ImportantDate[] {
  const upcoming = dates.filter((d) => daysUntil(d, today) >= 0).sort((a, b) => daysUntil(a, today) - daysUntil(b, today))
  const past = dates.filter((d) => daysUntil(d, today) < 0).sort((a, b) => daysUntil(b, today) - daysUntil(a, today))
  return [...upcoming, ...past]
}

export function todaysDates(dates: readonly ImportantDate[], today: string): ImportantDate[] {
  return dates.filter((d) => daysUntil(d, today) === 0)
}

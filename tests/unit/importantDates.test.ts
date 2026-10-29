import { describe, expect, it } from 'vitest'
import { dayNumber, DAILY_QUESTIONS, questionForDay } from '@/domain/dailyQuestions'
import { daysTogether, daysUntil, describeDate, nextOccurrence, sortedForDisplay, todaysDates } from '@/domain/importantDates'
import type { ImportantDate } from '@/shared/types'

const date = (over: Partial<ImportantDate>): ImportantDate => ({ id: 'x', authorId: 'daniel', title: 'T', date: '2023-09-14', kind: 'anniversary', yearly: true, createdAt: '', ...over })

describe('important dates', () => {
  it('finds the next yearly occurrence, counting today', () => {
    expect(nextOccurrence(date({}), '2025-06-01')).toBe('2025-09-14')
    expect(nextOccurrence(date({}), '2025-09-14')).toBe('2025-09-14')
    expect(nextOccurrence(date({}), '2025-09-15')).toBe('2026-09-14')
    expect(nextOccurrence(date({}), '2023-01-01')).toBe('2023-09-14')
  })

  it('keeps a leap-day date on 28 February in other years', () => {
    expect(nextOccurrence(date({ date: '2024-02-29' }), '2025-01-01')).toBe('2025-02-28')
    expect(nextOccurrence(date({ date: '2024-02-29' }), '2027-12-01')).toBe('2028-02-29')
  })

  it('treats one-off dates as themselves, past or future', () => {
    const trip = date({ date: '2025-08-01', yearly: false, kind: 'countdown' })
    expect(daysUntil(trip, '2025-06-01')).toBe(61)
    expect(daysUntil(trip, '2025-08-11')).toBe(-10)
  })

  it('describes today, tomorrow, soon and past, with year badges', () => {
    expect(describeDate(date({ date: '2023-06-01' }), '2025-06-01')).toEqual({ when: 'Today', badge: 'Year 2', isToday: true })
    expect(describeDate(date({ date: '2023-06-02' }), '2025-06-01').when).toBe('Tomorrow')
    expect(describeDate(date({ date: '2023-06-12' }), '2025-06-01')).toMatchObject({ when: 'in 11 days', badge: 'Year 2' })
    expect(describeDate(date({ date: '2025-05-30', yearly: false, kind: 'milestone' }), '2025-06-01').when).toBe('2 days ago')
    expect(describeDate(date({ date: '1999-06-05', kind: 'birthday' }), '2025-06-01').badge).toBe('26 years')
  })

  it('counts days together from the earliest anniversary', () => {
    expect(daysTogether([date({ date: '2025-05-01' }), date({ date: '2025-05-20' })], '2025-06-01')).toEqual({ days: 31, since: '2025-05-01' })
    expect(daysTogether([date({ kind: 'birthday' })], '2025-06-01')).toBeNull()
    expect(daysTogether([date({ date: '2026-01-01' })], '2025-06-01')).toBeNull()
  })

  it('sorts upcoming first (soonest), then the past (most recent first)', () => {
    const list = [date({ id: 'a', date: '2025-05-01', yearly: false }), date({ id: 'b', date: '2025-07-01', yearly: false }), date({ id: 'c', date: '2025-06-10', yearly: false }), date({ id: 'd', date: '2025-04-01', yearly: false })]
    expect(sortedForDisplay(list, '2025-06-01').map((d) => d.id)).toEqual(['c', 'b', 'a', 'd'])
    expect(todaysDates([...list, date({ id: 'e', date: '2020-06-01' })], '2025-06-01').map((d) => d.id)).toEqual(['e'])
  })
})

describe('daily question bank', () => {
  it('has distinct, non-empty questions and a stable pick per day', () => {
    expect(new Set(DAILY_QUESTIONS).size).toBe(DAILY_QUESTIONS.length)
    expect(DAILY_QUESTIONS.every((q) => q.length > 10)).toBe(true)
    expect(questionForDay('2025-06-01')).toBe(questionForDay('2025-06-01'))
    expect(questionForDay('2025-06-01')).not.toBe(questionForDay('2025-06-02'))
    expect(dayNumber('1970-01-02')).toBe(1)
    expect(questionForDay('1960-01-01')).toBeTruthy() // dates before 1970 still work
  })
})

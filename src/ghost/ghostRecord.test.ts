import { describe, expect, it } from 'vitest'
import { diffEdit, formatDelta, formatMs, ghostTextAt, IDLE_CAP_MS, judgeAgainstGhost, RunRecorder } from './ghostRecord'

describe('diffEdit', () => {
  it('describes an insertion, a deletion and a replacement', () => {
    expect(diffEdit('abc', 'abXc')).toEqual({ at: 2, del: 0, ins: 'X' })
    expect(diffEdit('abXc', 'abc')).toEqual({ at: 2, del: 1, ins: '' })
    expect(diffEdit('hello', 'help!')).toEqual({ at: 3, del: 2, ins: 'p!' })
    expect(diffEdit('same', 'same')).toBeNull()
  })
  it('handles repeated characters without overlapping prefix and suffix', () => {
    const edit = diffEdit('aa', 'aaa')!
    expect('aa'.slice(0, edit.at) + edit.ins + 'aa'.slice(edit.at + edit.del)).toBe('aaa')
  })
})

describe('RunRecorder', () => {
  it('replays to exactly the typed text', () => {
    const recorder = new RunRecorder('# start\n')
    let text = '# start\n'
    const steps = ['d', 'de', 'def', 'def ', 'def f', 'def f()', 'def f()', 'def f():', 'def f():\n    return 1']
    steps.forEach((next, index) => {
      text = next
      recorder.change(text, 1000 + index * 200)
    })
    const record = recorder.finish('mission:x', 5000)!
    expect(ghostTextAt(record, 0)).toBe('d')
    expect(ghostTextAt(record, record.ms)).toBe('def f():\n    return 1')
    expect(ghostTextAt(record, -1)).toBe('# start\n')
  })

  it('starts the clock at the first change, not at construction', () => {
    const recorder = new RunRecorder('')
    expect(recorder.elapsed(99999)).toBe(0)
    recorder.change('a', 5000)
    expect(recorder.elapsed(5400)).toBe(400)
  })

  it('caps long pauses so breaks do not count', () => {
    const recorder = new RunRecorder('')
    recorder.change('a', 0)
    recorder.change('ab', 10 * 60_000)
    const record = recorder.finish('k', 10 * 60_000)!
    expect(record.ms).toBe(IDLE_CAP_MS)
  })

  it('returns null when nothing was typed', () => {
    expect(new RunRecorder('x').finish('k', 100)).toBeNull()
  })
})

describe('ghost rules', () => {
  const ghost = { key: 'k', ms: 5000, recordedAt: 0, startText: '', edits: [] }
  it('replaces the ghost only when faster', () => {
    expect(judgeAgainstGhost(undefined, 9000)).toBe('first')
    expect(judgeAgainstGhost(ghost, 4999)).toBe('faster')
    expect(judgeAgainstGhost(ghost, 5000)).toBe('slower')
    expect(judgeAgainstGhost(ghost, 7000)).toBe('slower')
  })
  it('formats times', () => {
    expect(formatMs(83_400)).toBe('01:23.4')
    expect(formatMs(5_000)).toBe('00:05.0')
    expect(formatDelta(-1200)).toBe('-1.2s')
    expect(formatDelta(2500)).toBe('+2.5s')
  })
})

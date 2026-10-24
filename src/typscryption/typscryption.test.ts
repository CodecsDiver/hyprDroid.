import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { TYPSCRYPTION_CONTENT, contentForLevel, indentOf } from './content'
import { adaptLevel, botFixSeconds, botGuessSeconds, botLineSchedule, botLineSeconds, paceReport, seededRandom, shuffled } from './engine'
import { confidenceQuestion, placeLearner } from './intake'
import { LEVEL_COUNT, LEVEL_NAMES, SPEEDCODER_LINE_SECONDS, libraryOfLevel, type SkillLevel } from './levels'

function runPython(source: string): { stdout: string; code: number | null } {
  const run = spawnSync('python3', ['-I', '-c', source], { encoding: 'utf-8', timeout: 8000, env: { PATH: process.env.PATH ?? '' } })
  return { stdout: run.stdout, code: run.status }
}

const levels = Array.from({ length: LEVEL_COUNT }, (_, index) => (index + 1) as SkillLevel)

describe('the skill ladder', () => {
  it('has nine named levels, three per library, with slower averages for lower levels', () => {
    expect(LEVEL_NAMES).toHaveLength(9)
    expect(SPEEDCODER_LINE_SECONDS).toHaveLength(9)
    for (let i = 1; i < 9; i++) expect(SPEEDCODER_LINE_SECONDS[i]).toBeLessThan(SPEEDCODER_LINE_SECONDS[i - 1])
    expect([1, 3, 4, 6, 7, 9].map((level) => libraryOfLevel(level).id)).toEqual(['sprout', 'sprout', 'builder', 'builder', 'climber', 'climber'])
  })
})

describe('placement', () => {
  it('maps experience to a library and confidence to the level inside it', () => {
    expect(placeLearner({ experience: 'new', confidence: 'low', typing: 'steady' }).level).toBe(1)
    expect(placeLearner({ experience: 'new', confidence: 'high', typing: 'steady' }).level).toBe(3)
    expect(placeLearner({ experience: 'some', confidence: 'mid', typing: 'steady' }).level).toBe(5)
    expect(placeLearner({ experience: 'lots', confidence: 'high', typing: 'steady' }).level).toBe(9)
  })
  it('gives slow typists more time and fast typists less', () => {
    const factor = (typing: 'slow' | 'steady' | 'fast') => placeLearner({ experience: 'new', confidence: 'low', typing }).typingFactor
    expect(factor('slow')).toBeGreaterThan(factor('steady'))
    expect(factor('fast')).toBeLessThan(factor('steady'))
  })
  it('words the second question for the library you are in', () => {
    expect(confidenceQuestion('new').options[0].label).not.toBe(confidenceQuestion('lots').options[0].label)
  })
})

describe('the bot', () => {
  it('is faster at higher levels and for faster typists', () => {
    for (let level = 1; level < 9; level++) {
      expect(botLineSeconds(level + 1, 30, 1)).toBeLessThan(botLineSeconds(level, 30, 1))
      expect(botGuessSeconds(level + 1, 5, 30, 1)).toBeLessThan(botGuessSeconds(level, 5, 30, 1))
      expect(botFixSeconds(level + 1, 5, 30, 1)).toBeLessThan(botFixSeconds(level, 5, 30, 1))
    }
    expect(botLineSeconds(4, 30, 0.8)).toBeLessThan(botLineSeconds(4, 30, 1.25))
  })
  it('takes longer on longer lines and finishes lines in order', () => {
    expect(botLineSeconds(5, 60, 1)).toBeGreaterThan(botLineSeconds(5, 20, 1))
    const schedule = botLineSchedule(5, ['a = 1', 'b = 2', 'print(a + b)'], 1, seededRandom(7))
    expect(schedule).toEqual([...schedule].sort((x, y) => x - y))
    expect(schedule[0]).toBeGreaterThan(0)
  })
  it('is repeatable with the same seed', () => {
    expect(botLineSchedule(3, ['x = 1', 'y = 2'], 1, seededRandom(42))).toEqual(botLineSchedule(3, ['x = 1', 'y = 2'], 1, seededRandom(42)))
    expect(shuffled([1, 2, 3, 4, 5], seededRandom(3))).toHaveLength(5)
  })
})

describe('pace check', () => {
  const lines = ['a' .repeat(30), 'b'.repeat(30)]
  it('rates you against the average for your own level', () => {
    expect(paceReport(4, 15 * 2, lines).label).toBe('On pace')
    expect(paceReport(4, 15 * 2 * 0.7, lines).label).toBe('Ahead of pace')
    expect(paceReport(4, 15 * 2 * 0.5, lines).label).toBe('Elite pace')
    expect(paceReport(4, 15 * 2 * 2, lines).label).toBe('Building pace')
  })
})

describe('adaptation', () => {
  it('moves up after two wins and down after two losses, within the ladder', () => {
    let state = adaptLevel(4, 0, 0, true)
    expect(state).toMatchObject({ level: 4, winStreak: 1, change: 0 })
    state = adaptLevel(state.level, state.winStreak, state.lossStreak, true)
    expect(state).toMatchObject({ level: 5, change: 1, winStreak: 0 })
    expect(adaptLevel(9, 1, 0, true).level).toBe(9)
    expect(adaptLevel(1, 0, 1, false).level).toBe(1)
    expect(adaptLevel(5, 0, 1, false)).toMatchObject({ level: 4, change: -1 })
    expect(adaptLevel(5, 1, 0, false)).toMatchObject({ level: 5, winStreak: 0, lossStreak: 1 })
  })
})

describe('content', () => {
  it('has enough items for a whole match at every level', () => {
    for (const level of levels) {
      const content = contentForLevel(level)
      expect(content.guess.length).toBeGreaterThanOrEqual(3)
      expect(content.fix.length).toBeGreaterThanOrEqual(3)
      expect(content.speed.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('has unique ids and no blank lines', () => {
    const ids: string[] = []
    for (const level of levels) {
      const { guess, fix, speed } = TYPSCRYPTION_CONTENT[level]
      for (const item of [...guess, ...fix, ...speed]) {
        ids.push(item.id)
        for (const line of item.lines) expect(line.trim(), `${item.id} has a blank line`).not.toBe('')
      }
    }
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps speed blocks growing with the level', () => {
    const average = (level: SkillLevel) => {
      const blocks = TYPSCRYPTION_CONTENT[level].speed
      return blocks.reduce((sum, block) => sum + block.lines.length, 0) / blocks.length
    }
    expect(average(9)).toBeGreaterThan(average(1))
  })

  for (const level of levels) {
    const { guess, fix, speed } = TYPSCRYPTION_CONTENT[level]

    it(`level ${level}: guess items work with the right line and break with every wrong line`, () => {
      for (const item of guess) {
        const withLine = (line: string) => item.lines.map((original, index) => (index === item.hiddenIndex ? line : original)).join('\n')
        const right = runPython(withLine(item.lines[item.hiddenIndex]))
        expect(right.code, `${item.id} correct line must run`).toBe(0)
        for (const wrong of item.distractors) {
          const attempt = runPython(withLine(wrong))
          expect(attempt.code !== right.code || attempt.stdout !== right.stdout, `${item.id}: "${wrong}" behaves like the right answer`).toBe(true)
          expect(wrong.trim(), `${item.id}: a wrong line must not equal the right one`).not.toBe(item.lines[item.hiddenIndex].trim())
          expect(indentOf(wrong), `${item.id}: wrong lines keep the same indentation`).toBe(indentOf(item.lines[item.hiddenIndex]))
        }
      }
    })

    it(`level ${level}: fix items are broken until the line is fixed`, () => {
      for (const item of fix) {
        const fixedSource = item.lines.map((original, index) => (index === item.brokenIndex ? item.fixedLine : original)).join('\n')
        const fixed = runPython(fixedSource)
        expect(fixed.code, `${item.id} fixed version must run`).toBe(0)
        const broken = runPython(item.lines.join('\n'))
        expect(broken.code !== fixed.code || broken.stdout !== fixed.stdout, `${item.id}: broken version behaves like the fixed one`).toBe(true)
        expect(item.fixedLine).not.toBe(item.lines[item.brokenIndex])
      }
    })

    it(`level ${level}: speed blocks run cleanly`, () => {
      for (const item of speed) expect(runPython(item.lines.join('\n')).code, `${item.id} must run`).toBe(0)
    })
  }
})

import { describe, expect, it } from 'vitest'
import { MAX_FILES_PER_PROJECT, normalizeNewFileName, sortFileNames, validateNewFileName } from './fileNames'

describe('file names', () => {
  it('adds .py when it is missing', () => {
    expect(normalizeNewFileName('helpers')).toBe('helpers.py')
    expect(normalizeNewFileName('  helpers.py ')).toBe('helpers.py')
  })

  it('accepts ordinary names and rejects unsafe or unusable ones with a reason', () => {
    expect(validateNewFileName('helpers', ['main.py'])).toBeNull()
    expect(validateNewFileName('_private2.py', ['main.py'])).toBeNull()
    for (const bad of ['', '   ', '../x', 'a/b', 'has space', '9lives', '.hidden', 'a.b.py', 'ünï']) {
      expect(validateNewFileName(bad, ['main.py']), bad).not.toBeNull()
    }
  })

  it('rejects duplicates, the reserved checks file and too many files', () => {
    expect(validateNewFileName('main', ['main.py'])).toContain('already exists')
    expect(validateNewFileName('_checks', ['main.py'])).toContain('reserved')
    const full = Array.from({ length: MAX_FILES_PER_PROJECT }, (_, index) => `f${index}.py`)
    expect(validateNewFileName('one_more', full)).toContain('at most')
  })

  it('sorts main.py first', () => {
    expect(sortFileNames(['zeta.py', 'main.py', 'alpha.py', 'alpha.py'])).toEqual(['main.py', 'alpha.py', 'zeta.py'])
  })
})

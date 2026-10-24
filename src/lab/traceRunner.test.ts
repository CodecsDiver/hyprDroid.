import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LAB_COURSES } from './courses'
import { buildTraceRunnerSource, parseTraceOutput, type TraceMode } from './traceRunner'

function trace(mode: TraceMode, fileName: string, source: string) {
  const directory = mkdtempSync(join(tmpdir(), 'pydisc-trace-'))
  try {
    writeFileSync(join(directory, fileName), source)
    writeFileSync(join(directory, 'trace_runner.py'), buildTraceRunnerSource(mode, fileName))
    const run = spawnSync('python3', ['-B', 'trace_runner.py'], { cwd: directory, encoding: 'utf-8', timeout: 15000 })
    return parseTraceOutput(run.stdout)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

describe('auto trace mode (free code)', () => {
  it('follows a list at module level whatever it is called, in a file that is not main.py', () => {
    const frames = trace('auto', 'my_sort.py', `
numbers = [4, 3, 2, 1]
for end in range(len(numbers) - 1, 0, -1):
    for i in range(end):
        if numbers[i] > numbers[i + 1]:
            numbers[i], numbers[i + 1] = numbers[i + 1], numbers[i]
print(numbers)
`)
    expect(frames).not.toBeNull()
    expect(frames![0].values).toEqual([4, 3, 2, 1])
    expect(frames![frames!.length - 1].values).toEqual([1, 2, 3, 4])
  })

  it('follows a list changed inside a function', () => {
    const frames = trace('auto', 'main.py', `
def sort_it(arr):
    for i in range(1, len(arr)):
        j = i
        while j > 0 and arr[j - 1] > arr[j]:
            arr[j - 1], arr[j] = arr[j], arr[j - 1]
            j -= 1

data = [3, 1, 2]
sort_it(data)
`)
    expect(frames).not.toBeNull()
    expect(frames![frames!.length - 1].values).toEqual([1, 2, 3])
  })

  it('returns null when no list changes', () => {
    expect(trace('auto', 'main.py', 'print("hello")\n')).toBeNull()
  })
})

describe('items mode keeps working on main.py', () => {
  it('traces a list called items', () => {
    const frames = trace('items', 'main.py', 'items = [2, 1]\nitems[0], items[1] = items[1], items[0]\n')
    expect(frames).not.toBeNull()
  })
})

describe('every sorting course traces the real student code', () => {
  for (const course of LAB_COURSES.filter((candidate) => candidate.trace)) {
    it(`${course.id} records frames that end sorted`, () => {
      const frames = trace(course.trace!, 'main.py', course.code)
      expect(frames, course.id).not.toBeNull()
      const final = frames![frames!.length - 1].values
      expect(final).toEqual([...final].sort((a, b) => a - b))
    })
  }
})

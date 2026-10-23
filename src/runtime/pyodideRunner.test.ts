import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { loadPyodide } from 'pyodide'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildCheckSource, parseCheckOutput } from '../curriculum/harness'
import { PROJECTS } from '../curriculum/projects'
import { REFERENCE_SOLUTIONS } from '../curriculum/referenceSolutions'
import { runPythonFiles, type PyodideLike } from './pyodideRunner'

let pyodide: PyodideLike

beforeAll(async () => {
  const packageDirectory = dirname(createRequire(import.meta.url).resolve('pyodide/package.json'))
  pyodide = (await loadPyodide({ indexURL: packageDirectory })) as unknown as PyodideLike
}, 120_000)

describe('runPythonFiles (Pyodide)', () => {
  it('captures stdout and exit code 0', () => {
    const result = runPythonFiles(pyodide, { 'main.py': 'print("hello")\nprint("world")\n' }, 'main.py')
    expect(result.stdout).toBe('hello\nworld\n')
    expect(result.exitCode).toBe(0)
  })

  it('reports a student traceback on stderr without leaking runner frames', () => {
    const result = runPythonFiles(pyodide, { 'main.py': 'def f():\n    return 1 / 0\nf()\n' }, 'main.py')
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('ZeroDivisionError')
    expect(result.stderr).toContain('main.py')
    expect(result.stderr).not.toContain('runpy')
  })

  it('reports syntax errors and honours sys.exit codes', () => {
    expect(runPythonFiles(pyodide, { 'main.py': 'def broken(:\n' }, 'main.py').stderr).toContain('SyntaxError')
    expect(runPythonFiles(pyodide, { 'main.py': 'import sys\nsys.exit(3)\n' }, 'main.py').exitCode).toBe(3)
  })

  it('treats input() as end of input instead of hanging', () => {
    const result = runPythonFiles(pyodide, { 'main.py': 'input()\n' }, 'main.py')
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('EOFError')
  })

  it('does not leak modules or files between runs', () => {
    runPythonFiles(pyodide, { 'main.py': 'import helper\nprint(helper.VALUE)\n', 'helper.py': 'VALUE = 1\n' }, 'main.py')
    const second = runPythonFiles(pyodide, { 'main.py': 'import helper\nprint(helper.VALUE)\n', 'helper.py': 'VALUE = 2\n' }, 'main.py')
    expect(second.stdout).toBe('2\n')
    const third = runPythonFiles(pyodide, { 'main.py': 'import helper\n' }, 'main.py')
    expect(third.stderr).toContain('ModuleNotFoundError')
  })

  it('caps runaway output', () => {
    const result = runPythonFiles(pyodide, { 'main.py': 'for i in range(40000):\n    print("x" * 50)\n' }, 'main.py')
    expect(result.outputTruncated).toBe(true)
    expect(result.stdout.length).toBeLessThan(80 * 1024)
  })
})

describe.each(PROJECTS)('curriculum $id under Pyodide', (project) => {
  const nonce = 'pyodide-nonce-1234'
  const check = (studentCode: string) => {
    const result = runPythonFiles(
      pyodide,
      { 'main.py': studentCode, '_checks.py': buildCheckSource(project) },
      '_checks.py',
      { PYDISC_NONCE: nonce },
    )
    return parseCheckOutput(result.stdout, nonce)
  }

  it('fails every objective for the starter code', () => {
    const results = check(project.starterCode)
    expect(results).not.toBeNull()
    for (const objective of project.objectives) expect(results![`test_${objective.id}`].status).not.toBe('pass')
  })

  it('passes every objective for the reference solution', () => {
    const results = check(REFERENCE_SOLUTIONS[project.id])
    expect(results).not.toBeNull()
    for (const objective of project.objectives) {
      expect(results![`test_${objective.id}`], objective.id).toEqual({ status: 'pass', message: '' })
    }
  })

  it('reports an unimportable file as failed objectives', () => {
    const results = check('def broken(:\n')
    expect(results).not.toBeNull()
    for (const objective of project.objectives) expect(results![`test_${objective.id}`].status).toBe('fail')
  })
})

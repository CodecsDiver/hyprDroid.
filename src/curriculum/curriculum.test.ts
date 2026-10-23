import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildCheckSource, parseCheckOutput } from './harness'
import { PROJECTS } from './projects'
import { REFERENCE_SOLUTIONS } from './referenceSolutions'
import type { Project } from './types'

const NONCE = 'test-nonce-1234'

function runChecks(project: Project, studentCode: string) {
  const directory = mkdtempSync(join(tmpdir(), 'pydisc-curriculum-'))
  try {
    writeFileSync(join(directory, 'main.py'), studentCode)
    writeFileSync(join(directory, '_checks.py'), buildCheckSource(project))
    const run = spawnSync('python3', ['-B', '_checks.py'], {
      cwd: directory,
      env: { PATH: process.env.PATH ?? '', PYDISC_NONCE: NONCE },
      encoding: 'utf-8',
      timeout: 15000,
    })
    return parseCheckOutput(run.stdout, NONCE)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

describe.each(PROJECTS)('project $id', (project) => {
  it('has an objective for every test and a test for every objective', () => {
    const testNames = [...project.testSource.matchAll(/def test_(\w+)\(/g)].map((match) => match[1]).sort()
    const objectiveIds = project.objectives.map((objective) => objective.id).sort()
    expect(testNames).toEqual(objectiveIds)
  })

  it('fails every objective for the untouched starter code', () => {
    const results = runChecks(project, project.starterCode)
    expect(results).not.toBeNull()
    for (const objective of project.objectives) {
      expect(results![`test_${objective.id}`].status).not.toBe('pass')
    }
  })

  it('passes every objective for the reference solution', () => {
    const results = runChecks(project, REFERENCE_SOLUTIONS[project.id])
    expect(results).not.toBeNull()
    for (const objective of project.objectives) {
      expect(results![`test_${objective.id}`], objective.id).toEqual({ status: 'pass', message: '' })
    }
  })

  it('reports a broken file as unreported results instead of crashing the harness', () => {
    const results = runChecks(project, 'def broken(:\n')
    expect(results).not.toBeNull()
    for (const objective of project.objectives) {
      expect(results![`test_${objective.id}`].status).toBe('fail')
    }
  })
})

describe('parseCheckOutput', () => {
  it('ignores results printed under a different nonce and uses the last matching line', () => {
    const stdout = [
      '@@PYDISC:wrong@@{"test_a":{"status":"pass","message":""}}',
      '@@PYDISC:right@@{"test_a":{"status":"fail","message":"x"}}',
    ].join('\n')
    expect(parseCheckOutput(stdout, 'right')?.test_a.status).toBe('fail')
    expect(parseCheckOutput(stdout, 'missing')).toBeNull()
  })
})

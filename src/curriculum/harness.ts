import type { ObjectiveResult, Project } from './types'

const PRELUDE = `import json as _json
import os as _os
import sys as _sys
import unittest as _unittest

_NONCE = _os.environ.pop("PYDISC_NONCE", "")
try:
    import main as student
    _IMPORT_ERROR = None
except BaseException as _error:
    student = None
    _IMPORT_ERROR = "%s: %s" % (type(_error).__name__, _error)


class StudentTestCase(_unittest.TestCase):
    def setUp(self):
        if _IMPORT_ERROR is not None:
            self.fail("main.py could not be imported -> " + _IMPORT_ERROR)

`

const FOOTER = `

class _Result(_unittest.TestResult):
    def __init__(self):
        super().__init__()
        self.rows = {}

    def addSuccess(self, test):
        self.rows[test._testMethodName] = {"status": "pass", "message": ""}

    def addFailure(self, test, err):
        self.rows[test._testMethodName] = {"status": "fail", "message": str(err[1])[:400]}

    def addError(self, test, err):
        text = type(err[1]).__name__ + ": " + str(err[1])
        self.rows[test._testMethodName] = {"status": "error", "message": text[:400]}


if __name__ == "__main__":
    _result = _Result()
    _unittest.defaultTestLoader.loadTestsFromModule(_sys.modules["__main__"]).run(_result)
    _sys.stdout.flush()
    _sys.__stdout__.write("\\n@@PYDISC:" + _NONCE + "@@" + _json.dumps(_result.rows) + "\\n")
`

export function buildCheckSource(project: Project): string {
  return PRELUDE + project.testSource.trim() + '\n' + FOOTER
}

/**
 * Reads the nonce-tagged results line. Returns null when the run never reached the
 * reporting step (syntax error at import, infinite loop, crash, timeout).
 */
export function parseCheckOutput(stdout: string, nonce: string): Record<string, ObjectiveResult> | null {
  const marker = `@@PYDISC:${nonce}@@`
  const line = stdout.split('\n').reverse().find((candidate) => candidate.startsWith(marker))
  if (!line) return null
  try {
    return JSON.parse(line.slice(marker.length)) as Record<string, ObjectiveResult>
  } catch {
    return null
  }
}

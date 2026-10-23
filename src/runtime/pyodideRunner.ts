/**
 * Runs student Python inside a loaded Pyodide instance (WebAssembly CPython).
 * Shared by the web worker and by the Node tests, so the same code path is exercised in both.
 */

export const WORK_DIRECTORY = '/work'
export const OUTPUT_LIMIT_BYTES = 64 * 1024

/** The slice of the Pyodide API this runner uses. */
export interface PyodideLike {
  FS: {
    mkdirTree(path: string): void
    writeFile(path: string, data: string): void
    readdir(path: string): string[]
    unlink(path: string): void
  }
  runPython(code: string): unknown
  globals: { get(name: string): (...args: unknown[]) => unknown }
  setStdout(options: { batched: (line: string) => void }): void
  setStderr(options: { batched: (line: string) => void }): void
  setStdin(options: { stdin: () => string | null | undefined }): void
}

export interface PythonRunResult {
  stdout: string
  stderr: string
  exitCode: number
  outputTruncated: boolean
}

const BOOTSTRAP = `
import json, os, runpy, sys, traceback

def __pydisc_run(entry, work, environment_json):
    os.chdir(work)
    sys.path.insert(0, work)
    for key, value in json.loads(environment_json).items():
        os.environ[key] = value
    exit_code = 0
    try:
        runpy.run_path(os.path.join(work, entry), run_name="__main__")
    except SystemExit as stop:
        if stop.code is None:
            exit_code = 0
        elif isinstance(stop.code, int):
            exit_code = stop.code
        else:
            print(stop.code, file=sys.stderr)
            exit_code = 1
    except BaseException as error:
        trace = error.__traceback__
        while trace is not None and (
            "runpy" in trace.tb_frame.f_code.co_filename or trace.tb_frame.f_code.co_filename.startswith("<")
        ):
            trace = trace.tb_next
        traceback.print_exception(type(error), error, trace)
        exit_code = 1
    finally:
        try:
            sys.path.remove(work)
        except ValueError:
            pass
        for name in list(sys.modules):
            location = getattr(sys.modules[name], "__file__", None)
            if isinstance(location, str) and location.startswith(work):
                del sys.modules[name]
        for key in json.loads(environment_json):
            os.environ.pop(key, None)
    return exit_code
`

const bootstrapped = new WeakSet<object>()

function ensureBootstrapped(pyodide: PyodideLike): void {
  if (bootstrapped.has(pyodide)) return
  pyodide.runPython(BOOTSTRAP)
  bootstrapped.add(pyodide)
}

function resetWorkDirectory(pyodide: PyodideLike, files: Record<string, string>): void {
  pyodide.FS.mkdirTree(WORK_DIRECTORY)
  for (const existing of pyodide.FS.readdir(WORK_DIRECTORY)) {
    if (existing !== '.' && existing !== '..') pyodide.FS.unlink(`${WORK_DIRECTORY}/${existing}`)
  }
  for (const [name, content] of Object.entries(files)) pyodide.FS.writeFile(`${WORK_DIRECTORY}/${name}`, content)
}

function createCappedCollector(): { push(line: string): void; text(): string; wasTruncated(): boolean } {
  const lines: string[] = []
  let size = 0
  let truncated = false
  return {
    push(line) {
      if (size >= OUTPUT_LIMIT_BYTES) {
        truncated = true
        return
      }
      lines.push(line)
      size += line.length + 1
    },
    text: () => lines.join('\n') + (lines.length > 0 ? '\n' : ''),
    wasTruncated: () => truncated,
  }
}

export function runPythonFiles(
  pyodide: PyodideLike,
  files: Record<string, string>,
  entry: string,
  environment: Record<string, string> = {},
): PythonRunResult {
  ensureBootstrapped(pyodide)
  resetWorkDirectory(pyodide, files)

  const stdout = createCappedCollector()
  const stderr = createCappedCollector()
  pyodide.setStdout({ batched: (line) => stdout.push(line) })
  pyodide.setStderr({ batched: (line) => stderr.push(line) })
  pyodide.setStdin({ stdin: () => null })

  const exitCode = pyodide.globals.get('__pydisc_run')(entry, WORK_DIRECTORY, JSON.stringify(environment)) as number
  return {
    stdout: stdout.text(),
    stderr: stderr.text(),
    exitCode,
    outputTruncated: stdout.wasTruncated() || stderr.wasTruncated(),
  }
}

import { invoke } from '@tauri-apps/api/core'
import { runInWebPython } from '../runtime/webPython'

export interface BackendError {
  code: string
  message: string
}

export interface RunOutcome {
  stdout: string
  stderr: string
  exitCode: number | null
  timedOut: boolean
  outputTruncated: boolean
  isolation: 'bubblewrap' | 'none' | 'wasm'
}

export interface SandboxStatus {
  pythonPath: string | null
  bubblewrapUsable: boolean
}

export type DocumentName = 'settings' | 'progression' | 'theme' | 'practice' | 'typscryption'

/**
 * Two runtimes share one UI. In the desktop app (Tauri) the Rust backend stores files on disk and runs
 * system Python in bubblewrap. In the PWA / browser there is no native backend, so documents and project
 * files live in localStorage and Python runs in WebAssembly (Pyodide) inside a Web Worker.
 */
export function isNativeRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export function toBackendError(error: unknown): BackendError {
  if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error) {
    return error as BackendError
  }
  return { code: 'unknown', message: error instanceof Error ? error.message : String(error) }
}

const WEB_PREFIX = 'pydisc-web:'

function webRead(key: string): string | null {
  try {
    return localStorage.getItem(WEB_PREFIX + key)
  } catch {
    return null
  }
}

function webWrite(key: string, value: string): void {
  try {
    localStorage.setItem(WEB_PREFIX + key, value)
  } catch {
    throw { code: 'storage', message: 'browser storage is unavailable' } satisfies BackendError
  }
}

function webProjectFiles(projectId: string): Record<string, string> {
  const prefix = `${WEB_PREFIX}file:${projectId}/`
  const files: Record<string, string> = {}
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index)
      if (key?.startsWith(prefix)) files[key.slice(prefix.length)] = localStorage.getItem(key) ?? ''
    }
  } catch {
    throw { code: 'storage', message: 'browser storage is unavailable' } satisfies BackendError
  }
  return files
}

export async function loadDocument<TDocument>(name: DocumentName): Promise<TDocument | null> {
  if (!isNativeRuntime()) {
    const text = webRead(`doc:${name}`)
    return text === null ? null : (JSON.parse(text) as TDocument)
  }
  return invoke<TDocument | null>('load_document', { name })
}

export async function saveDocument<TDocument>(name: DocumentName, value: TDocument): Promise<void> {
  if (!isNativeRuntime()) return webWrite(`doc:${name}`, JSON.stringify(value))
  await invoke('save_document', { name, value })
}

export async function readProjectFile(projectId: string, fileName: string): Promise<string | null> {
  if (!isNativeRuntime()) return webRead(`file:${projectId}/${fileName}`)
  return invoke<string | null>('read_project_file', { projectId, fileName })
}

export async function writeProjectFile(projectId: string, fileName: string, content: string): Promise<void> {
  if (!isNativeRuntime()) return webWrite(`file:${projectId}/${fileName}`, content)
  await invoke('write_project_file', { projectId, fileName, content })
}

export async function listProjectFiles(projectId: string): Promise<string[]> {
  if (!isNativeRuntime()) return Object.keys(webProjectFiles(projectId)).sort()
  return invoke<string[]>('list_project_files', { projectId })
}

export async function deleteProjectFile(projectId: string, fileName: string): Promise<void> {
  if (!isNativeRuntime()) {
    try {
      localStorage.removeItem(`${WEB_PREFIX}file:${projectId}/${fileName}`)
    } catch {
      throw { code: 'storage', message: 'browser storage is unavailable' } satisfies BackendError
    }
    return
  }
  await invoke('delete_project_file', { projectId, fileName })
}

export async function renameProjectFile(projectId: string, from: string, to: string): Promise<void> {
  if (!isNativeRuntime()) {
    const content = webRead(`file:${projectId}/${from}`)
    if (content === null) throw { code: 'file-not-found', message: `${from} does not exist` } satisfies BackendError
    if (webRead(`file:${projectId}/${to}`) !== null) {
      throw { code: 'file-already-exists', message: `${to} already exists` } satisfies BackendError
    }
    webWrite(`file:${projectId}/${to}`, content)
    await deleteProjectFile(projectId, from)
    return
  }
  await invoke('rename_project_file', { projectId, from, to })
}

export async function getSandboxStatus(): Promise<SandboxStatus | null> {
  if (!isNativeRuntime()) return null
  return invoke<SandboxStatus>('sandbox_status')
}

async function runOnWeb(files: Record<string, string>, entry: string, environment: Record<string, string> = {}): Promise<RunOutcome> {
  try {
    const result = await runInWebPython(files, entry, environment)
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.timedOut ? null : result.exitCode,
      timedOut: result.timedOut,
      outputTruncated: result.outputTruncated,
      isolation: 'wasm',
    }
  } catch (error) {
    throw { code: 'no-python', message: `Python could not start in the browser: ${toBackendError(error).message}` } satisfies BackendError
  }
}

export async function runPython(projectId: string, fileName: string, allowUnsandboxed: boolean): Promise<RunOutcome> {
  if (!isNativeRuntime()) {
    const files = webProjectFiles(projectId)
    if (!(fileName in files)) throw { code: 'file-not-found', message: `${fileName} has not been saved yet` } satisfies BackendError
    return runOnWeb(files, fileName)
  }
  return invoke<RunOutcome>('run_python', { projectId, fileName, allowUnsandboxed })
}

export async function runChecks(
  projectId: string,
  testSource: string,
  nonce: string,
  allowUnsandboxed: boolean,
): Promise<RunOutcome> {
  if (!isNativeRuntime()) {
    return runOnWeb({ ...webProjectFiles(projectId), '_checks.py': testSource }, '_checks.py', { PYDISC_NONCE: nonce })
  }
  return invoke<RunOutcome>('run_checks', { projectId, testSource, nonce, allowUnsandboxed })
}

/** The colour tool linked from the theme editor. The address is fixed here and in the Rust command. */
export const THEME_SITE_URL = 'https://colorthemepark.netlify.app'

export async function openThemeSite(): Promise<void> {
  if (!isNativeRuntime()) {
    window.open(THEME_SITE_URL, '_blank', 'noopener,noreferrer')
    return
  }
  await invoke('open_theme_site')
}

export async function openSolutionWindow(): Promise<void> {
  if (!isNativeRuntime()) {
    window.open(`${location.pathname}?view=solution`, 'pydisc-solution', 'width=980,height=860')
    return
  }
  await invoke('open_solution_window')
}

export async function openLabWindow(): Promise<void> {
  if (!isNativeRuntime()) {
    window.open(`${location.pathname}?view=lab`, 'pydisc-lab', 'width=1240,height=820')
    return
  }
  await invoke('open_lab_window')
}

import { invoke } from '@tauri-apps/api/core'

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
  isolation: 'bubblewrap' | 'none'
}

export interface SandboxStatus {
  pythonPath: string | null
  bubblewrapUsable: boolean
}

export type DocumentName = 'settings' | 'progression'

/**
 * The plain-browser preview (`pnpm dev` without Tauri) has no native backend.
 * Documents and project files fall back to localStorage so the UI can be developed;
 * running Python is NOT simulated and fails with `preview-mode`.
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

const PREVIEW_PREFIX = 'pydisc-preview:'

function previewRead(key: string): string | null {
  try {
    return localStorage.getItem(PREVIEW_PREFIX + key)
  } catch {
    return null
  }
}

function previewWrite(key: string, value: string): void {
  try {
    localStorage.setItem(PREVIEW_PREFIX + key, value)
  } catch {
    throw { code: 'storage', message: 'browser storage is unavailable' } satisfies BackendError
  }
}

const previewOnly = (action: string): BackendError => ({
  code: 'preview-mode',
  message: `${action} needs the desktop app. This is the browser preview.`,
})

export async function loadDocument<TDocument>(name: DocumentName): Promise<TDocument | null> {
  if (!isNativeRuntime()) {
    const text = previewRead(`doc:${name}`)
    return text === null ? null : (JSON.parse(text) as TDocument)
  }
  return invoke<TDocument | null>('load_document', { name })
}

export async function saveDocument<TDocument>(name: DocumentName, value: TDocument): Promise<void> {
  if (!isNativeRuntime()) return previewWrite(`doc:${name}`, JSON.stringify(value))
  await invoke('save_document', { name, value })
}

export async function readProjectFile(projectId: string, fileName: string): Promise<string | null> {
  if (!isNativeRuntime()) return previewRead(`file:${projectId}/${fileName}`)
  return invoke<string | null>('read_project_file', { projectId, fileName })
}

export async function writeProjectFile(projectId: string, fileName: string, content: string): Promise<void> {
  if (!isNativeRuntime()) return previewWrite(`file:${projectId}/${fileName}`, content)
  await invoke('write_project_file', { projectId, fileName, content })
}

export async function getSandboxStatus(): Promise<SandboxStatus | null> {
  if (!isNativeRuntime()) return null
  return invoke<SandboxStatus>('sandbox_status')
}

export async function runPython(projectId: string, fileName: string, allowUnsandboxed: boolean): Promise<RunOutcome> {
  if (!isNativeRuntime()) throw previewOnly('Running Python')
  return invoke<RunOutcome>('run_python', { projectId, fileName, allowUnsandboxed })
}

export async function runChecks(
  projectId: string,
  testSource: string,
  nonce: string,
  allowUnsandboxed: boolean,
): Promise<RunOutcome> {
  if (!isNativeRuntime()) throw previewOnly('Checking your work')
  return invoke<RunOutcome>('run_checks', { projectId, testSource, nonce, allowUnsandboxed })
}

export async function openLessonsWindow(): Promise<void> {
  if (!isNativeRuntime()) {
    window.open(`${location.pathname}?view=lessons`, 'pydisc-lessons', 'width=1240,height=820')
    return
  }
  await invoke('open_lessons_window')
}

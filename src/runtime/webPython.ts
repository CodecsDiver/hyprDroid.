import type { WorkerRequest, WorkerResponse } from './pythonWorker'
import type { PythonRunResult } from './pyodideRunner'

const WALL_TIMEOUT_MS = 10_000
const BOOT_TIMEOUT_MS = 120_000

let worker: Worker | undefined
let isReady = false
let requestCounter = 0
let bootPromise: Promise<void> | undefined

export type WebPythonStatus = 'idle' | 'booting' | 'ready' | 'failed'
let status: WebPythonStatus = 'idle'
let failureMessage = ''
const statusListeners = new Set<(status: WebPythonStatus, failureMessage: string) => void>()

function setStatus(next: WebPythonStatus): void {
  status = next
  statusListeners.forEach((listener) => listener(next, failureMessage))
}

export function onWebPythonStatus(listener: (status: WebPythonStatus, failureMessage: string) => void): () => void {
  statusListeners.add(listener)
  listener(status, failureMessage)
  return () => {
    statusListeners.delete(listener)
  }
}

function pyodideBaseUrl(): string {
  return new URL(`${import.meta.env.BASE_URL}pyodide/`, document.baseURI).href
}

function send<TResponse extends WorkerResponse>(request: WorkerRequest, timeoutMs: number): Promise<TResponse> {
  return new Promise((resolve, reject) => {
    const current = worker!
    const timer = setTimeout(() => {
      current.removeEventListener('message', onMessage)
      reject(new Error('timeout'))
    }, timeoutMs)
    function onMessage(event: MessageEvent<WorkerResponse>): void {
      if (event.data.id !== request.id) return
      clearTimeout(timer)
      current.removeEventListener('message', onMessage)
      current.removeEventListener('error', onError)
      resolve(event.data as TResponse)
    }
    // A worker that cannot even load (for example no module-worker support) never replies.
    function onError(event: ErrorEvent): void {
      clearTimeout(timer)
      current.removeEventListener('message', onMessage)
      current.removeEventListener('error', onError)
      reject(new Error(event.message || 'the Python worker failed to load (this browser may not support module workers)'))
    }
    current.addEventListener('message', onMessage)
    current.addEventListener('error', onError)
    current.postMessage(request)
  })
}

function discardWorker(): void {
  worker?.terminate()
  worker = undefined
  isReady = false
  bootPromise = undefined
  setStatus('idle')
}

/** Starts the worker and loads Python. Safe to call repeatedly; also used to pre-warm. */
export function bootWebPython(): Promise<void> {
  if (isReady) return Promise.resolve()
  if (bootPromise) return bootPromise
  failureMessage = ''
  setStatus('booting')
  try {
    worker = new Worker(new URL('./pythonWorker.ts', import.meta.url), { type: 'module' })
  } catch (error) {
    // Browsers without module-worker support throw here instead of firing an error event.
    failureMessage = `module workers are not supported (${error instanceof Error ? error.message : String(error)})`
    setStatus('failed')
    return Promise.reject(new Error(failureMessage))
  }
  bootPromise = send({ id: ++requestCounter, kind: 'init', pyodideBaseUrl: pyodideBaseUrl() }, BOOT_TIMEOUT_MS)
    .then((response) => {
      if (!response.ok) throw new Error(response.message)
      isReady = true
      setStatus('ready')
    })
    .catch((error) => {
      discardWorker()
      failureMessage = error instanceof Error ? error.message : String(error)
      setStatus('failed')
      throw error
    })
  return bootPromise
}

export interface WebRunOutcome extends PythonRunResult {
  timedOut: boolean
}

/** An infinite loop cannot be interrupted inside WebAssembly, so a timeout terminates the worker. */
export async function runInWebPython(
  files: Record<string, string>,
  entry: string,
  environment: Record<string, string> = {},
): Promise<WebRunOutcome> {
  await bootWebPython()
  try {
    const response = await send(
      { id: ++requestCounter, kind: 'run', files, entry, environment },
      WALL_TIMEOUT_MS,
    )
    if (!response.ok) throw new Error(response.message)
    return { ...response.result!, timedOut: false }
  } catch (error) {
    if (error instanceof Error && error.message === 'timeout') {
      discardWorker()
      return { stdout: '', stderr: '', exitCode: -1, outputTruncated: false, timedOut: true }
    }
    throw error
  }
}

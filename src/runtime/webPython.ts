import type { WorkerRequest, WorkerResponse } from './pythonWorker'
import type { PythonRunResult } from './pyodideRunner'

const WALL_TIMEOUT_MS = 10_000
const BOOT_TIMEOUT_MS = 120_000

let worker: Worker | undefined
let isReady = false
let requestCounter = 0
let bootPromise: Promise<void> | undefined

export type WebPythonStatus = 'idle' | 'booting' | 'ready'
let status: WebPythonStatus = 'idle'
const statusListeners = new Set<(status: WebPythonStatus) => void>()

function setStatus(next: WebPythonStatus): void {
  status = next
  statusListeners.forEach((listener) => listener(next))
}

export function onWebPythonStatus(listener: (status: WebPythonStatus) => void): () => void {
  statusListeners.add(listener)
  listener(status)
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
      resolve(event.data as TResponse)
    }
    current.addEventListener('message', onMessage)
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
  setStatus('booting')
  worker = new Worker(new URL('./pythonWorker.ts', import.meta.url), { type: 'module' })
  bootPromise = send({ id: ++requestCounter, kind: 'init', pyodideBaseUrl: pyodideBaseUrl() }, BOOT_TIMEOUT_MS)
    .then((response) => {
      if (!response.ok) throw new Error(response.message)
      isReady = true
      setStatus('ready')
    })
    .catch((error) => {
      discardWorker()
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

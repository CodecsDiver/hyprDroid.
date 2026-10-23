/// <reference lib="webworker" />
import { runPythonFiles, type PyodideLike } from './pyodideRunner'

export type WorkerRequest =
  | { id: number; kind: 'init'; pyodideBaseUrl: string }
  | { id: number; kind: 'run'; files: Record<string, string>; entry: string; environment: Record<string, string> }

export type WorkerResponse =
  | { id: number; ok: true; result?: ReturnType<typeof runPythonFiles> }
  | { id: number; ok: false; message: string }

let pyodide: PyodideLike | undefined

/**
 * After Pyodide has loaded, remove the browser's network APIs from this worker so student code
 * cannot reach the network. Pyodide itself no longer needs them for the standard library.
 */
function removeNetworkAccess(): void {
  const scope = self as unknown as Record<string, unknown>
  for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts', 'WebTransport']) {
    try {
      scope[name] = undefined
    } catch {
      // Some globals are read-only in some engines; best effort.
    }
  }
}

async function initialize(pyodideBaseUrl: string): Promise<void> {
  if (pyodide) return
  const module = await import(/* @vite-ignore */ `${pyodideBaseUrl}pyodide.mjs`)
  pyodide = (await module.loadPyodide({ indexURL: pyodideBaseUrl })) as PyodideLike
  removeNetworkAccess()
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data
  const reply = (response: WorkerResponse) => self.postMessage(response)
  try {
    if (request.kind === 'init') {
      await initialize(request.pyodideBaseUrl)
      reply({ id: request.id, ok: true })
      return
    }
    if (!pyodide) throw new Error('Python has not been initialized')
    const result = runPythonFiles(pyodide, request.files, request.entry, request.environment)
    reply({ id: request.id, ok: true, result })
  } catch (error) {
    reply({ id: request.id, ok: false, message: error instanceof Error ? error.message : String(error) })
  }
}

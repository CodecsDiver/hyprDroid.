import { reactive } from 'vue'

export type ToastTone = 'info' | 'success' | 'warning' | 'error' | 'love'

export interface ToastAction {
  label: string
  run: () => void
}

export interface Toast {
  id: number
  message: string
  tone: ToastTone
  action?: ToastAction
}

export const toasts = reactive<Toast[]>([])
let nextId = 1

export function showToast(message: string, options: { tone?: ToastTone; timeoutMs?: number; action?: ToastAction } = {}): number {
  const id = nextId++
  toasts.push({ id, message, tone: options.tone ?? 'info', ...(options.action ? { action: options.action } : {}) })
  if (toasts.length > 4) toasts.splice(0, toasts.length - 4)
  const timeout = options.timeoutMs ?? (options.tone === 'error' ? 7000 : 4500)
  if (timeout > 0) setTimeout(() => dismissToast(id), timeout)
  return id
}

export function dismissToast(id: number): void {
  const index = toasts.findIndex((toast) => toast.id === id)
  if (index >= 0) toasts.splice(index, 1)
}

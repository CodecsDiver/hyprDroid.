import { onMounted, onScopeDispose, ref, type Ref } from 'vue'
import { toAppError } from '@/data/errors'
import type { WatchedTable } from '@/data/realtime'
import { onTableChange } from './live'
import { showToast } from './toasts'

export interface Resource<T> {
  data: Ref<T>
  loading: Ref<boolean>
  error: Ref<string | null>
  reload: () => Promise<void>
}

/**
 * Loads data on mount and again whenever any watched table changes (realtime).
 * Late responses from superseded loads are discarded.
 */
export function useResource<T>(loader: () => Promise<T>, initial: T, tables: readonly WatchedTable[] = []): Resource<T> {
  const data = ref(initial) as Ref<T>
  const loading = ref(true)
  const error = ref<string | null>(null)
  let generation = 0

  async function reload(): Promise<void> {
    const mine = ++generation
    try {
      const result = await loader()
      if (mine !== generation) return
      data.value = result
      error.value = null
    } catch (caught) {
      if (mine !== generation) return
      error.value = toAppError(caught).userMessage
    } finally {
      if (mine === generation) loading.value = false
    }
  }

  onMounted(() => void reload())
  const offs = tables.map((table) => onTableChange(table, () => void reload()))
  onScopeDispose(() => {
    generation++ // ignore anything still in flight
    offs.forEach((off) => off())
  })
  return { data, loading, error, reload }
}

export interface Action<A extends unknown[]> {
  run: (...args: A) => Promise<boolean>
  busy: Ref<boolean>
}

/** Wraps a mutation: prevents double-submits, reports failures as friendly toasts. */
export function useAction<A extends unknown[]>(work: (...args: A) => Promise<void>, options: { success?: string } = {}): Action<A> {
  const busy = ref(false)
  async function run(...args: A): Promise<boolean> {
    if (busy.value) return false
    busy.value = true
    try {
      await work(...args)
      if (options.success) showToast(options.success, { tone: 'success' })
      return true
    } catch (caught) {
      const error = toAppError(caught)
      showToast(error.code === 'validation' ? error.message : error.userMessage, { tone: 'error' })
      return false
    } finally {
      busy.value = false
    }
  }
  return { run, busy }
}

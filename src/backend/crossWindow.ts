import { emit, listen } from '@tauri-apps/api/event'
import { isNativeRuntime } from './backend'

const LESSON_STUDIED_EVENT = 'lesson-studied'
const PREVIEW_CHANNEL_NAME = 'pydisc-preview'

interface LessonStudiedPayload {
  lessonId: string
}

export async function publishLessonStudied(lessonId: string): Promise<void> {
  const payload: LessonStudiedPayload = { lessonId }
  if (isNativeRuntime()) {
    await emit(LESSON_STUDIED_EVENT, payload)
    return
  }
  const channel = new BroadcastChannel(PREVIEW_CHANNEL_NAME)
  channel.postMessage(payload)
  channel.close()
}

/** Returns an unsubscribe function. */
export async function subscribeLessonStudied(handler: (lessonId: string) => void): Promise<() => void> {
  if (isNativeRuntime()) {
    return listen<LessonStudiedPayload>(LESSON_STUDIED_EVENT, (event) => handler(event.payload.lessonId))
  }
  const channel = new BroadcastChannel(PREVIEW_CHANNEL_NAME)
  channel.onmessage = (event: MessageEvent<LessonStudiedPayload>) => handler(event.data.lessonId)
  return () => channel.close()
}

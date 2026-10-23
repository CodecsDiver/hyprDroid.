import { ref } from 'vue'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const deferred = ref<BeforeInstallPromptEvent | null>(null)
export const canInstall = ref(false)

export function listenForInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferred.value = event as BeforeInstallPromptEvent
    canInstall.value = true
  })
  window.addEventListener('appinstalled', () => {
    deferred.value = null
    canInstall.value = false
  })
}

export async function promptInstall(): Promise<void> {
  const event = deferred.value
  if (!event) return
  await event.prompt()
  await event.userChoice
  deferred.value = null
  canInstall.value = false
}

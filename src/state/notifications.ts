import { inQuietHours } from '@/data/repos/settings'
import type { EventKind } from '@/domain/events'
import { home } from './household'

const SETTING_FOR_KIND: Partial<Record<EventKind, 'notifyLovePings' | 'notifyHiddenNotes' | 'notifyMischief' | 'notifyListeningInvites'>> = {
  love_ping: 'notifyLovePings', heart_tap: 'notifyLovePings', hug: 'notifyLovePings', sticker: 'notifyLovePings', love_note: 'notifyLovePings',
  spell_cast: 'notifyLovePings', note_placed: 'notifyHiddenNotes', mischief: 'notifyMischief', listening_invite: 'notifyListeningInvites',
}

export function notificationsSupported(): boolean {
  return typeof Notification !== 'undefined'
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return 'denied'
  return Notification.requestPermission()
}

/**
 * Shows a system notification only when: the user allowed it in the browser,
 * enabled it for this kind in their per-user settings, it is not quiet hours,
 * and the app is not in the foreground. Foreground delivery uses in-app UI.
 */
export async function notifyIfAppropriate(kind: EventKind, title: string, body: string, tag: string): Promise<void> {
  if (!notificationsSupported() || Notification.permission !== 'granted' || !document.hidden) return
  const key = SETTING_FOR_KIND[kind]
  if (key && !home.settings[key]) return
  if (inQuietHours(home.settings, new Date().getHours())) return
  try {
    const registration = await navigator.serviceWorker?.getRegistration()
    if (registration) await registration.showNotification(title, { body, tag, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png' })
    else new Notification(title, { body, tag, icon: '/icons/icon-192.png' })
  } catch {
    /* notifications are best-effort */
  }
}

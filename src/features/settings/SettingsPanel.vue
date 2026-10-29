<script setup lang="ts">
import { computed, ref } from 'vue'
import PanelShell from '@/components/PanelShell.vue'
import type { UserSettings } from '@/data/repos/settings'
import { home, myName, partnerName, updateSettings } from '@/state/household'
import { canInstall, promptInstall } from '@/state/install'
import { notificationsSupported, requestNotificationPermission } from '@/state/notifications'
import { prefs } from '@/state/prefs'
import { entrance, parseSoundCloudUrl, startEntranceMusic, stopEntranceMusic } from '@/audio/entrance'
import { backupFileName, decodeBackup } from '@/local/backup'
import { eraseEverything, makeBackup, restoreBackup } from '@/local/backend'
import { switchPerson } from '@/state/session'
import { openPanel } from '@/state/ui'
import { showToast } from '@/state/toasts'
import { useAction } from '@/state/useAsync'
import type { PanelDefinition } from '../panels'

defineProps<{ definition: PanelDefinition }>()
defineEmits<{ close: [] }>()

const permission = ref<NotificationPermission>(notificationsSupported() ? Notification.permission : 'denied')
const hours = Array.from({ length: 24 }, (_, h) => h)

const save = useAction(async (changes: Partial<UserSettings>) => {
  await updateSettings(changes)
})
const leave = useAction(async () => {
  await switchPerson()
})
const entranceLink = ref(prefs.entranceUrl)
const entranceValid = computed(() => entranceLink.value.trim() === '' || parseSoundCloudUrl(entranceLink.value) !== null)
function saveEntrance(): void {
  const parsed = parseSoundCloudUrl(entranceLink.value)
  if (!parsed) return
  prefs.entranceUrl = parsed
  entranceLink.value = parsed
  prefs.entranceOn = true
  showToast('Saved. Your album will start when you come in.', { tone: 'success' })
}
function clearEntrance(): void {
  prefs.entranceUrl = ''
  prefs.entranceOn = false
  entranceLink.value = ''
  stopEntranceMusic()
}
function tryEntrance(): void {
  if (!startEntranceMusic(prefs.entranceUrl || entranceLink.value, prefs.volume)) showToast('That is not a SoundCloud link.', { tone: 'warning' })
}

const restoreInput = ref<HTMLInputElement | null>(null)
const backup = useAction(async () => {
  const url = URL.createObjectURL(makeBackup())
  const link = document.createElement('a')
  link.href = url
  link.download = backupFileName()
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}, { success: 'Backup saved. Keep it somewhere safe: it contains everything, including photos and private notes.' })
const restore = useAction(async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const backupData = decodeBackup(await file.text()) // a file that is not a backup is refused here, before anything is asked or changed
  const made = backupData.createdAt ? ` made on ${backupData.createdAt.slice(0, 10)}` : ''
  if (!window.confirm(`Replace everything in this browser with the backup${made}? What is here now will be lost.`)) return
  await restoreBackup(backupData)
})
const erase = useAction(async () => {
  if (window.confirm('Erase everything Signal Home has stored in this browser, for both of you? This cannot be undone.')) await eraseEverything()
})

async function askNotifications(): Promise<void> {
  permission.value = await requestNotificationPermission()
  if (permission.value === 'denied') showToast('Notifications are blocked in your browser settings for this site.', { tone: 'warning' })
}

const quiet = computed({
  get: () => home.settings.quietHoursStart !== null && home.settings.quietHoursEnd !== null,
  set: (on: boolean) => void save.run(on ? { quietHoursStart: 22, quietHoursEnd: 7 } : { quietHoursStart: null, quietHoursEnd: null }),
})
const toggles: { key: keyof UserSettings; label: string }[] = [
  { key: 'notifyLovePings', label: 'Love pings, hugs, stickers and spells' },
  { key: 'notifyHiddenNotes', label: 'Hidden notes' },
  { key: 'notifyMischief', label: 'Mischief' },
  { key: 'notifyListeningInvites', label: 'Listening invites' },
]
</script>

<template>
  <PanelShell :title="definition.title" :icon="definition.icon" @close="$emit('close')">
    <div class="stack">
      <section class="stack" aria-labelledby="acct">
        <h3 id="acct">You</h3>
        <p class="hint">You are {{ myName }}. Your partner is {{ partnerName }}. Everything is kept only in this browser; nothing is sent anywhere.</p>
        <button type="button" class="btn btn--small btn--quiet" @click="leave.run()">Switch person</button>
        <button type="button" class="btn btn--small btn--danger" @click="erase.run()">Erase everything in this browser</button>
      </section>

      <section class="stack" aria-labelledby="entrance-h">
        <h3 id="entrance-h">Entrance album (SoundCloud)</h3>
        <p class="hint">Paste a link to your SoundCloud album, playlist or track. It starts playing when you come in. This is the one thing that uses the internet: SoundCloud’s own player is loaded, so SoundCloud can see this browser’s address and may set its own cookies. Nothing is loaded unless you save a link here.</p>
        <form class="stack" @submit.prevent="saveEntrance">
          <div class="field">
            <label for="entrance-link">SoundCloud link</label>
            <input id="entrance-link" v-model="entranceLink" class="input" type="text" inputmode="url" autocomplete="off" spellcheck="false" placeholder="soundcloud.com/your-name/sets/your-album" :aria-invalid="!entranceValid" aria-describedby="entrance-note" />
            <span id="entrance-note" class="hint" :role="entranceValid ? undefined : 'alert'">{{ entranceValid ? (prefs.entranceUrl ? 'Saved.' : 'Only soundcloud.com links are accepted.') : 'That is not a soundcloud.com link.' }}</span>
          </div>
          <label class="switch"><input v-model="prefs.entranceOn" type="checkbox" :disabled="!prefs.entranceUrl" /><span>Play it when I come in</span></label>
          <div class="row">
            <button type="submit" class="btn btn--small btn--primary" :disabled="!entranceValid || entranceLink.trim() === ''">Save link</button>
            <button type="button" class="btn btn--small" :disabled="!entranceValid || (!prefs.entranceUrl && entranceLink.trim() === '')" @click="entrance.active ? stopEntranceMusic() : tryEntrance()">{{ entrance.active ? 'Stop it' : 'Play it now' }}</button>
            <button v-if="prefs.entranceUrl" type="button" class="btn btn--small btn--quiet" @click="clearEntrance">Remove</button>
          </div>
        </form>
      </section>

      <section class="stack" aria-labelledby="backup-h">
        <h3 id="backup-h">Backup</h3>
        <p class="hint">Everything lives only in this browser, so clearing the browser’s data would erase it. A backup is one file with all of it (including photos, songs and private notes). Restoring replaces what is here.</p>
        <div class="row">
          <button type="button" class="btn btn--small" :disabled="backup.busy.value" @click="backup.run()">Save a backup</button>
          <button type="button" class="btn btn--small" :disabled="restore.busy.value" @click="restoreInput?.click()">Restore a backup…</button>
          <input ref="restoreInput" class="visually-hidden" type="file" accept="application/json,.json" tabindex="-1" aria-hidden="true" @change="restore.run($event)" />
        </div>
      </section>

      <section class="stack" aria-labelledby="notif">
        <h3 id="notif">Notifications</h3>
        <p class="hint">Your choices are kept in this browser. They only control what <em>you</em> are alerted about.</p>
        <label v-for="t in toggles" :key="t.key" class="switch">
          <input type="checkbox" :checked="home.settings[t.key] as boolean" :disabled="save.busy.value" @change="save.run({ [t.key]: ($event.target as HTMLInputElement).checked })" />
          <span>{{ t.label }}</span>
        </label>
        <label class="switch"><input v-model="quiet" type="checkbox" /><span>Quiet hours</span></label>
        <div v-if="quiet" class="row">
          <div class="field"><label for="q-from">From</label><select id="q-from" class="input" :value="home.settings.quietHoursStart ?? 22" @change="save.run({ quietHoursStart: Number(($event.target as HTMLSelectElement).value) })"><option v-for="h in hours" :key="h" :value="h">{{ String(h).padStart(2, '0') }}:00</option></select></div>
          <div class="field"><label for="q-to">Until</label><select id="q-to" class="input" :value="home.settings.quietHoursEnd ?? 7" @change="save.run({ quietHoursEnd: Number(($event.target as HTMLSelectElement).value) })"><option v-for="h in hours" :key="h" :value="h">{{ String(h).padStart(2, '0') }}:00</option></select></div>
        </div>
        <div v-if="notificationsSupported()" class="stack">
          <button v-if="permission !== 'granted'" type="button" class="btn btn--small" :disabled="permission === 'denied'" @click="askNotifications">Allow notifications on this device</button>
          <p class="hint">
            {{ permission === 'granted' ? 'Allowed. You will be alerted when this app is open in the background.' : permission === 'denied' ? 'Blocked in your browser settings.' : 'Not allowed yet.' }}
            Alerts while the app is fully closed need a push server, which is not set up (see docs/LIMITATIONS.md). Anything sent meanwhile is waiting for you when you open the app.
          </p>
        </div>
      </section>

      <section class="stack" aria-labelledby="consent">
        <h3 id="consent">Consent</h3>
        <p class="hint">Playful surprises and disruptive effects are off until you turn them on. {{ home.settings.allowMischief ? 'Mischief is ON.' : 'Mischief is off.' }}</p>
        <button type="button" class="btn btn--small" @click="openPanel('mischief')">Manage mischief</button>
      </section>

      <section class="stack" aria-labelledby="device">
        <h3 id="device">This device</h3>
        <label class="switch"><input v-model="prefs.soundOn" type="checkbox" /><span>Sound</span></label>
        <div class="field"><label for="vol">Volume</label><input id="vol" v-model.number="prefs.volume" type="range" min="0" max="1" step="0.05" :disabled="!prefs.soundOn" /></div>
        <div class="field"><label for="motion">Motion</label>
          <select id="motion" v-model="prefs.motion" class="input"><option value="auto">Follow my device setting</option><option value="reduced">Reduce motion</option><option value="full">Full motion</option></select>
          <span class="hint">Reduced motion replaces animated effects with calm, static ones and moves the camera instantly.</span>
        </div>
        <div class="field"><label for="quality">3D quality</label>
          <select id="quality" v-model="prefs.quality" class="input"><option value="auto">Automatic</option><option value="low">Low (saves battery)</option><option value="medium">Medium</option><option value="high">High</option></select>
          <span class="hint">Takes effect next time you open the app.</span>
        </div>
        <button v-if="canInstall" type="button" class="btn btn--small btn--primary" @click="promptInstall()">Install Signal Home</button>
      </section>

      <section class="stack" aria-labelledby="about">
        <h3 id="about">About</h3>
        <p class="hint">The room you see is a <strong>placeholder</strong>: simple shapes standing in for the final Blender artwork, which hasn't been added yet. Your data, privacy and real-time features are real.</p>
      </section>
    </div>
  </PanelShell>
</template>

<style scoped>
.grow { flex: 1; }
.switch { display: flex; gap: var(--space-3); align-items: center; min-height: var(--tap-target); font-size: var(--text-sm); }
.switch input { width: 22px; height: 22px; accent-color: var(--color-gold); flex: none; }
input[type='range'] { width: 100%; accent-color: var(--color-gold); }
h3 { margin-top: var(--space-2); }
</style>

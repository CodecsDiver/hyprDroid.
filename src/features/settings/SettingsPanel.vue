<script setup lang="ts">
import { computed, ref } from 'vue'
import InvitePartner from '@/components/InvitePartner.vue'
import PanelShell from '@/components/PanelShell.vue'
import { updateDisplayName } from '@/data/repos/household'
import type { UserSettings } from '@/data/repos/settings'
import { home, myName, partnerName, updateSettings } from '@/state/household'
import { canInstall, promptInstall } from '@/state/install'
import { notificationsSupported, requestNotificationPermission } from '@/state/notifications'
import { prefs } from '@/state/prefs'
import { session, signOut } from '@/state/session'
import { openPanel } from '@/state/ui'
import { showToast } from '@/state/toasts'
import { useAction } from '@/state/useAsync'
import type { PanelDefinition } from '../panels'

defineProps<{ definition: PanelDefinition }>()
defineEmits<{ close: [] }>()

const permission = ref<NotificationPermission>(notificationsSupported() ? Notification.permission : 'denied')
const name = ref(home.me?.displayName ?? '')
const hours = Array.from({ length: 24 }, (_, h) => h)

const save = useAction(async (changes: Partial<UserSettings>) => {
  if (session.userId) await updateSettings(session.userId, changes)
})
const rename = useAction(async () => {
  if (!session.userId || !name.value.trim()) return
  await updateDisplayName(session.userId, name.value.trim())
  if (home.me) home.me.displayName = name.value.trim()
}, { success: 'Name updated.' })
const leave = useAction(async () => {
  if (window.confirm('Sign out of Signal Home on this device?')) await signOut()
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
        <p class="hint">Signed in as {{ session.email }}. Partner: {{ home.partner ? partnerName : 'not joined yet' }}.</p>
        <form class="row" @submit.prevent="rename.run()">
          <div class="field grow"><label for="display-name">Your name</label><input id="display-name" v-model="name" class="input" maxlength="40" required /></div>
          <button type="submit" class="btn btn--small" :disabled="rename.busy.value || name.trim() === myName">Save</button>
        </form>
        <InvitePartner v-if="!home.partner" />
        <button type="button" class="btn btn--small btn--quiet" @click="leave.run()">Sign out</button>
      </section>

      <section class="stack" aria-labelledby="notif">
        <h3 id="notif">Notifications</h3>
        <p class="hint">Your choices are saved to your account and apply to every device you use. They only control what <em>you</em> are alerted about.</p>
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

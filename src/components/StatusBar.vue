<script setup lang="ts">
import { computed } from 'vue'
import { retryOutbox, live } from '@/state/live'
import { partnerName } from '@/state/household'

const label = computed(() => {
  switch (live.status) {
    case 'live': return 'Live'
    case 'connecting': return 'Connecting…'
    case 'reconnecting': return 'Reconnecting…'
    case 'offline': return 'Offline'
    default: return 'Not connected'
  }
})
const tone = computed(() => (live.status === 'live' ? 'ok' : live.status === 'offline' ? 'bad' : 'wait'))
</script>

<template>
  <div class="status" role="status" aria-live="polite">
    <span class="status__chip" :class="`status__chip--${tone}`"><span class="status__dot" aria-hidden="true" />{{ label }}</span>
    <button v-if="live.pending > 0" type="button" class="status__chip status__chip--queue" @click="retryOutbox">
      {{ live.pending }} waiting to send
    </button>
    <span v-if="live.partnerHere" class="status__chip status__chip--here">💗 {{ partnerName }} is here</span>
  </div>
</template>

<style scoped>
.status { display: flex; flex-wrap: wrap; gap: var(--space-1); align-items: center; }
.status__chip {
  display: inline-flex; align-items: center; gap: 6px; min-height: 28px; padding: 0 var(--space-3);
  border: 1px solid var(--line-soft); border-radius: var(--radius-pill); background: rgba(0, 0, 0, 0.35);
  font-size: var(--text-xs); font-weight: 700; color: var(--color-ink);
}
button.status__chip { cursor: pointer; border-color: var(--line-gold); }
.status__dot { width: 8px; height: 8px; border-radius: 50%; background: var(--color-mint); }
.status__chip--wait .status__dot { background: var(--color-gold); }
.status__chip--bad .status__dot { background: var(--color-danger); }
.status__chip--here { border-color: var(--color-rose); }
</style>

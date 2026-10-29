<script setup lang="ts">
import { computed, ref } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import PanelShell from '@/components/PanelShell.vue'
import ResourceView from '@/components/ResourceView.vue'
import { addDate, deleteDate, fetchDates, type DateKind, type ImportantDate } from '@/data/repos/keepsakes'
import { daysTogether, describeDate, localDay, sortedForDisplay } from '@/domain/importantDates'
import { session } from '@/state/session'
import { useAction, useResource } from '@/state/useAsync'
import type { PanelDefinition } from '../panels'

defineProps<{ definition: PanelDefinition }>()
defineEmits<{ close: [] }>()

const KINDS: { id: DateKind; label: string; emoji: string; yearly: boolean }[] = [
  { id: 'anniversary', label: 'Anniversary', emoji: '💞', yearly: true },
  { id: 'birthday', label: 'Birthday', emoji: '🎂', yearly: true },
  { id: 'countdown', label: 'Countdown', emoji: '⏳', yearly: false },
  { id: 'milestone', label: 'Milestone', emoji: '⭐', yearly: false },
]
const emojiFor = (kind: DateKind): string => KINDS.find((k) => k.id === kind)?.emoji ?? '📅'

const dates = useResource(fetchDates, [] as ImportantDate[], ['important_dates'])
const today = computed(() => localDay(new Date()))
const together = computed(() => daysTogether(dates.data.value, today.value))
const shown = computed(() => sortedForDisplay(dates.data.value, today.value).map((item) => ({ item, ...describeDate(item, today.value) })))

const form = ref({ title: '', date: localDay(new Date()), kind: 'anniversary' as DateKind, yearly: true })
function pickKind(): void {
  form.value.yearly = KINDS.find((k) => k.id === form.value.kind)?.yearly ?? false
}

const add = useAction(async () => {
  await addDate({ ...form.value })
  form.value = { ...form.value, title: '' }
  await dates.reload()
}, { success: 'Added to the calendar.' })

const remove = useAction(async (item: ImportantDate) => {
  if (!window.confirm(`Remove “${item.title}”?`)) return
  await deleteDate(item.id)
  await dates.reload()
})
</script>

<template>
  <PanelShell :title="definition.title" :icon="definition.icon" @close="$emit('close')">
    <div class="stack">
      <p v-if="together" class="card together" role="status">
        <strong>{{ together.days.toLocaleString() }}</strong> days together
        <span class="hint">since {{ together.since }}</span>
      </p>

      <ResourceView :loading="dates.loading.value" :error="dates.error.value" @retry="dates.reload">
        <EmptyState v-if="shown.length === 0" emoji="📅" title="Nothing on the calendar yet" hint="Add your anniversary and the first day will start counting." />
        <ul v-else class="plain" role="list">
          <li v-for="entry in shown" :key="entry.item.id" class="card entry" :class="{ 'entry--today': entry.isToday }">
            <span class="entry__emoji" aria-hidden="true">{{ emojiFor(entry.item.kind) }}</span>
            <div class="grow">
              <p class="entry__title">{{ entry.item.title }} <span v-if="entry.badge" class="chip">{{ entry.badge }}</span></p>
              <p class="hint">{{ entry.item.date }}{{ entry.item.yearly ? ' · every year' : '' }}</p>
            </div>
            <p class="entry__when" :class="{ 'entry__when--today': entry.isToday }">{{ entry.when }}</p>
            <button v-if="entry.item.authorId === session.userId" type="button" class="btn btn--small btn--quiet" :aria-label="`Remove ${entry.item.title}`" @click="remove.run(entry.item)">🗑</button>
          </li>
        </ul>
      </ResourceView>

      <section class="stack" aria-labelledby="add-date-h">
        <h3 id="add-date-h">Add a date</h3>
        <form class="stack" @submit.prevent="add.run()">
          <div class="field"><label for="date-title">What is it?</label><input id="date-title" v-model="form.title" class="input" maxlength="60" required /></div>
          <div class="row">
            <div class="field grow"><label for="date-day">Date</label><input id="date-day" v-model="form.date" class="input" type="date" required /></div>
            <div class="field grow">
              <label for="date-kind">Kind</label>
              <select id="date-kind" v-model="form.kind" class="input" @change="pickKind"><option v-for="k in KINDS" :key="k.id" :value="k.id">{{ k.label }}</option></select>
            </div>
          </div>
          <label class="switch"><input v-model="form.yearly" type="checkbox" /><span>Repeat every year</span></label>
          <button type="submit" class="btn btn--primary" :disabled="add.busy.value">Add</button>
        </form>
      </section>
    </div>
  </PanelShell>
</template>

<style scoped>
.plain { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--space-2); }
.together { text-align: center; margin: 0; font-size: var(--text-lg); }
.together strong { font-size: 1.6em; color: var(--color-gold); }
.entry { display: flex; gap: var(--space-3); align-items: center; }
.entry--today { border-color: var(--color-gold); box-shadow: 0 0 18px rgba(255, 211, 122, 0.35); }
.entry__emoji { font-size: 1.6rem; }
.entry__title { margin: 0; font-weight: 700; overflow-wrap: anywhere; }
.entry__when { margin: 0; white-space: nowrap; font-weight: 700; }
.entry__when--today { color: var(--color-gold); }
.grow { flex: 1; min-width: 0; }
.switch { display: flex; gap: var(--space-3); align-items: center; min-height: var(--tap-target); font-size: var(--text-sm); }
.switch input { width: 22px; height: 22px; accent-color: var(--color-gold); flex: none; }
</style>

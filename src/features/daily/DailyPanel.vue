<script setup lang="ts">
import { ref, watch } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import PanelShell from '@/components/PanelShell.vue'
import ResourceView from '@/components/ResourceView.vue'
import { answerDaily, fetchDaily, fetchDailyHistory, type DailyHistoryEntry, type DailyQuestion } from '@/data/repos/keepsakes'
import { localDay } from '@/domain/importantDates'
import { myName, partnerName } from '@/state/household'
import { session } from '@/state/session'
import { useAction, useResource } from '@/state/useAsync'
import type { PanelDefinition } from '../panels'

defineProps<{ definition: PanelDefinition }>()
defineEmits<{ close: [] }>()

const day = localDay(new Date())
const empty: DailyQuestion = { day, question: '', mine: null, partnerAnswered: false, partner: null }
const today = useResource(() => fetchDaily(day), empty, ['daily_answers'])
const history = useResource(fetchDailyHistory, [] as DailyHistoryEntry[], ['daily_answers'])

const draft = ref('')
const editing = ref(false)
watch(() => today.data.value.mine, (mine) => { if (!editing.value) draft.value = mine ?? '' }, { immediate: true })

const save = useAction(async () => {
  await answerDaily(day, draft.value)
  editing.value = false
  await Promise.all([today.reload(), history.reload()])
}, { success: 'Saved. Your answer stays secret until you have both answered.' })

const nameOf = (id: string): string => (id === session.userId ? myName.value : partnerName.value)
</script>

<template>
  <PanelShell :title="definition.title" :icon="definition.icon" @close="$emit('close')">
    <div class="stack">
      <ResourceView :loading="today.loading.value" :error="today.error.value" @retry="today.reload">
        <section class="card stack" aria-labelledby="q-h">
          <p class="hint">Today’s question</p>
          <h3 id="q-h" class="question">{{ today.data.value.question }}</h3>

          <form v-if="today.data.value.mine === null || editing" class="stack" @submit.prevent="save.run()">
            <div class="field">
              <label for="answer">Your answer</label>
              <textarea id="answer" v-model="draft" class="input" rows="4" maxlength="500" required />
              <span class="hint" aria-live="polite">{{ draft.length }} / 500</span>
            </div>
            <div class="row">
              <button type="submit" class="btn btn--primary" :disabled="save.busy.value">Save my answer</button>
              <button v-if="editing" type="button" class="btn btn--quiet" @click="editing = false; draft = today.data.value.mine ?? ''">Cancel</button>
            </div>
            <p v-if="today.data.value.partnerAnswered" class="hint" role="status">{{ partnerName }} has answered. You will see it as soon as you do.</p>
          </form>

          <template v-else>
            <div class="answer">
              <p class="hint">{{ myName }}</p>
              <p class="answer__text">{{ today.data.value.mine }}</p>
            </div>
            <div v-if="today.data.value.partner !== null" class="answer answer--theirs">
              <p class="hint">{{ partnerName }}</p>
              <p class="answer__text">{{ today.data.value.partner }}</p>
            </div>
            <p v-else class="hint" role="status">Waiting for {{ partnerName }}’s answer. It will appear here.</p>
            <button v-if="!today.data.value.partnerAnswered" type="button" class="btn btn--small btn--quiet" @click="editing = true">Reword my answer</button>
          </template>
        </section>
      </ResourceView>

      <section class="stack" aria-labelledby="past-h">
        <h3 id="past-h">Past answers</h3>
        <EmptyState v-if="history.data.value.length === 0" emoji="🪧" title="No finished days yet" hint="A day shows up here once you have both answered." />
        <ul v-else class="plain" role="list">
          <li v-for="entry in history.data.value" :key="entry.day" class="card stack">
            <p class="hint">{{ entry.day }}</p>
            <p class="past__q">{{ entry.question }}</p>
            <p v-for="(text, id) in entry.answers" :key="id" class="past__a"><strong>{{ nameOf(String(id)) }}:</strong> {{ text }}</p>
          </li>
        </ul>
      </section>
    </div>
  </PanelShell>
</template>

<style scoped>
.question { margin: 0; font-family: var(--font-serif); font-size: var(--text-lg); }
.answer { background: var(--surface-glass); border-radius: var(--radius-sm); padding: var(--space-2) var(--space-3); }
.answer--theirs { border: 1px solid var(--color-gold); }
.answer__text { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-family: var(--font-serif); }
.plain { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--space-2); }
.past__q { margin: 0; font-weight: 700; }
.past__a { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
</style>

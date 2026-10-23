<script setup lang="ts">
import { computed, ref } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import PanelShell from '@/components/PanelShell.vue'
import ResourceView from '@/components/ResourceView.vue'
import { playSfx } from '@/audio/engine'
import { addIdea, addIdeas, completeIdea, deleteIdea, fetchIdeas, setFavorite } from '@/data/repos/dateJar'
import { DATE_CATEGORIES, drawIdea, STARTER_IDEAS, type DateCategory, type DateIdea } from '@/domain/dateJar'
import { relativeTime } from '@/domain/time'
import { reducedMotion } from '@/state/prefs'
import { useAction, useResource } from '@/state/useAsync'
import type { PanelDefinition } from '../panels'

defineProps<{ definition: PanelDefinition }>()
defineEmits<{ close: [] }>()

const ideas = useResource(fetchIdeas, [] as DateIdea[], ['date_ideas'])
const tab = ref<'jar' | 'favorites' | 'done'>('jar')
const categoryFilter = ref<DateCategory>('anything')
const drawn = ref<DateIdea | null>(null)
const shaking = ref(false)
const completing = ref<DateIdea | null>(null)
const doneNote = ref('')
const rating = ref<number | null>(null)
const form = ref({ title: '', notes: '', category: 'anything' as DateCategory })

const open = computed(() => ideas.data.value.filter((i) => !i.completedAt))
const favorites = computed(() => open.value.filter((i) => i.isFavorite))
const done = computed(() => ideas.data.value.filter((i) => i.completedAt).sort((a, b) => Date.parse(b.completedAt ?? '') - Date.parse(a.completedAt ?? '')))
const visible = computed(() => (tab.value === 'jar' ? open.value : tab.value === 'favorites' ? favorites.value : done.value))
const categoryLabel = (id: DateCategory): string => DATE_CATEGORIES.find((c) => c.id === id)?.label ?? id

function draw(): void {
  const pick = drawIdea(open.value, { category: categoryFilter.value, excludeId: drawn.value?.id ?? null })
  playSfx('glass')
  shaking.value = !reducedMotion.value
  setTimeout(() => {
    shaking.value = false
    drawn.value = pick
    if (pick) playSfx('confirm')
  }, reducedMotion.value ? 0 : 650)
}

const add = useAction(async () => {
  await addIdea(form.value)
  form.value = { title: '', notes: '', category: form.value.category }
  await ideas.reload()
}, { success: 'Added to the jar.' })

const addStarters = useAction(async () => {
  await addIdeas(STARTER_IDEAS)
  await ideas.reload()
}, { success: 'Starter ideas added.' })

const favorite = useAction(async (idea: DateIdea) => {
  await setFavorite(idea.id, !idea.isFavorite)
  if (drawn.value?.id === idea.id) drawn.value = { ...drawn.value, isFavorite: !idea.isFavorite }
  await ideas.reload()
})

const finish = useAction(async () => {
  if (!completing.value) return
  await completeIdea(completing.value.id, doneNote.value, rating.value)
  if (drawn.value?.id === completing.value.id) drawn.value = null
  completing.value = null
  doneNote.value = ''
  rating.value = null
  playSfx('confirm')
  await ideas.reload()
}, { success: 'Marked as done — what a memory.' })

const remove = useAction(async (idea: DateIdea) => {
  if (!window.confirm(`Remove “${idea.title}” from the jar?`)) return
  await deleteIdea(idea.id)
  if (drawn.value?.id === idea.id) drawn.value = null
  await ideas.reload()
})
</script>

<template>
  <PanelShell :title="definition.title" :icon="definition.icon" @close="$emit('close')">
    <div class="stack">
      <section class="stack" aria-labelledby="draw-h">
        <h3 id="draw-h">Draw an idea</h3>
        <div class="row">
          <label class="visually-hidden" for="cat">Category</label>
          <select id="cat" v-model="categoryFilter" class="input grow"><option v-for="c in DATE_CATEGORIES" :key="c.id" :value="c.id">{{ c.label }}</option></select>
          <button type="button" class="btn btn--primary" :disabled="open.length === 0 || shaking" @click="draw">
            <span class="jar" :class="{ 'jar--shake': shaking }" aria-hidden="true">🫙</span> Draw
          </button>
        </div>
        <div v-if="drawn" class="card stack drawn" role="status" aria-live="polite">
          <p class="drawn__title">{{ drawn.title }}</p>
          <p v-if="drawn.notes" class="hint">{{ drawn.notes }}</p>
          <span class="chip">{{ categoryLabel(drawn.category) }}</span>
          <div class="row">
            <button type="button" class="btn btn--primary btn--small" @click="completing = drawn">We did it!</button>
            <button type="button" class="btn btn--small" @click="draw">Draw again</button>
            <button type="button" class="btn btn--small" :aria-pressed="drawn.isFavorite" @click="favorite.run(drawn)">{{ drawn.isFavorite ? '★ Favorite' : '☆ Favorite' }}</button>
          </div>
        </div>
        <p v-else-if="open.length > 0" class="hint">Shake the jar and see what you get.</p>
      </section>

      <form v-if="completing" class="card stack" @submit.prevent="finish.run()">
        <h4>How was “{{ completing.title }}”?</h4>
        <div class="row" role="group" aria-label="Rating">
          <button v-for="n in 5" :key="n" type="button" class="btn btn--small" :aria-pressed="(rating ?? 0) >= n" :aria-label="`${n} star${n > 1 ? 's' : ''}`" @click="rating = n">★</button>
        </div>
        <div class="field"><label for="done-note">A note to remember it by (optional)</label><textarea id="done-note" v-model="doneNote" class="input" maxlength="500" /></div>
        <div class="row"><button type="submit" class="btn btn--primary btn--small" :disabled="finish.busy.value">Save</button><button type="button" class="btn btn--small btn--quiet" @click="completing = null">Cancel</button></div>
      </form>

      <section class="stack" aria-labelledby="add-h">
        <h3 id="add-h">Add an idea</h3>
        <form class="stack" @submit.prevent="add.run()">
          <div class="field"><label for="idea-title">Idea</label><input id="idea-title" v-model="form.title" class="input" maxlength="120" required /></div>
          <div class="field"><label for="idea-notes">Details (optional)</label><input id="idea-notes" v-model="form.notes" class="input" maxlength="500" /></div>
          <div class="row">
            <select v-model="form.category" class="input grow" aria-label="Category"><option v-for="c in DATE_CATEGORIES" :key="c.id" :value="c.id">{{ c.label }}</option></select>
            <button type="submit" class="btn btn--small" :disabled="add.busy.value">Add</button>
          </div>
        </form>
      </section>

      <section class="stack" aria-labelledby="list-h">
        <h3 id="list-h" class="visually-hidden">Your ideas</h3>
        <div class="row" role="tablist" aria-label="Idea lists">
          <button v-for="t in (['jar', 'favorites', 'done'] as const)" :key="t" type="button" role="tab" class="btn btn--small" :aria-selected="tab === t" :class="{ 'is-active': tab === t }" @click="tab = t">
            {{ t === 'jar' ? `In the jar (${open.length})` : t === 'favorites' ? `Favorites (${favorites.length})` : `Done (${done.length})` }}
          </button>
        </div>
        <ResourceView :loading="ideas.loading.value" :error="ideas.error.value" @retry="ideas.reload">
          <EmptyState v-if="visible.length === 0" emoji="🫙" :title="tab === 'done' ? 'Nothing done yet' : 'Nothing here yet'" :hint="tab === 'jar' ? 'Add your own, or start with a few.' : undefined">
            <button v-if="tab === 'jar' && ideas.data.value.length === 0" type="button" class="btn btn--small" :disabled="addStarters.busy.value" @click="addStarters.run()">Add starter ideas</button>
          </EmptyState>
          <ul v-else class="plain" role="list">
            <li v-for="idea in visible" :key="idea.id" class="card idea">
              <div class="grow">
                <p class="idea__title">{{ idea.title }}</p>
                <p class="hint">{{ categoryLabel(idea.category) }}<template v-if="idea.completedAt"> · done {{ relativeTime(idea.completedAt) }}<template v-if="idea.rating"> · {{ '★'.repeat(idea.rating) }}</template></template></p>
                <p v-if="idea.completedNote" class="hint">“{{ idea.completedNote }}”</p>
              </div>
              <button v-if="!idea.completedAt" type="button" class="btn btn--small btn--quiet" :aria-pressed="idea.isFavorite" :aria-label="idea.isFavorite ? `Remove ${idea.title} from favorites` : `Favorite ${idea.title}`" @click="favorite.run(idea)">{{ idea.isFavorite ? '★' : '☆' }}</button>
              <button v-if="!idea.completedAt" type="button" class="btn btn--small btn--quiet" :aria-label="`Mark ${idea.title} as done`" @click="completing = idea">✓</button>
              <button type="button" class="btn btn--small btn--quiet" :aria-label="`Remove ${idea.title}`" @click="remove.run(idea)">🗑</button>
            </li>
          </ul>
        </ResourceView>
      </section>
    </div>
  </PanelShell>
</template>

<style scoped>
.grow { flex: 1; min-width: 0; }
.plain { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--space-2); }
.idea { display: flex; gap: var(--space-2); align-items: center; }
.idea__title { margin: 0; font-weight: 700; overflow-wrap: anywhere; }
.drawn__title { margin: 0; font-family: var(--font-display); font-size: var(--text-lg); color: var(--color-gold-strong); overflow-wrap: anywhere; }
.jar { display: inline-block; }
.jar--shake { animation: shake 0.65s ease-in-out; }
@keyframes shake { 0%, 100% { transform: rotate(0); } 15% { transform: rotate(-18deg); } 35% { transform: rotate(16deg); } 55% { transform: rotate(-12deg); } 75% { transform: rotate(10deg); } }
h3, h4 { margin-top: var(--space-1); }
</style>

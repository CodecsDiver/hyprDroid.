<script setup lang="ts">
import { computed, ref } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import PanelShell from '@/components/PanelShell.vue'
import ResourceView from '@/components/ResourceView.vue'
import { playSfx } from '@/audio/engine'
import { deleteRecipe, fetchRecipes, saveRecipe, type SpellRecipe } from '@/data/repos/spells'
import { MAX_INGREDIENTS, SPELL_EFFECTS, STARTER_INGREDIENTS, spellEffect, type SpellEffectId } from '@/domain/spells'
import { cleanText, ValidationError } from '@/domain/validate'
import { playEffect } from '@/effects/bus'
import { inboxEntries } from '@/state/eventHandlers'
import { partnerName } from '@/state/household'
import { sendEvent } from '@/state/live'
import { session } from '@/state/session'
import { useAction, useResource } from '@/state/useAsync'
import type { PanelDefinition } from '../panels'

defineProps<{ definition: PanelDefinition }>()
defineEmits<{ close: [] }>()

const recipes = useResource(fetchRecipes, [] as SpellRecipe[], ['spell_recipes'])
const form = ref({ name: '', ingredients: [] as string[], effect: 'sparkle_burst' as SpellEffectId, color: '#c9a7ff', message: '' })
const custom = ref('')
const REACTION_CHIPS = ['❤️', '😍', '✨', '😂', '🥰']

const effectInfo = computed(() => spellEffect(form.value.effect))
const mine = computed(() => recipes.data.value.filter((r) => r.authorId === session.userId))
const theirs = computed(() => recipes.data.value.filter((r) => r.authorId !== session.userId))
const receivedSpells = computed(() => inboxEntries.filter((entry) => entry.kind === 'spell_cast').slice(0, 5))

function toggleIngredient(name: string): void {
  const list = form.value.ingredients
  const index = list.indexOf(name)
  if (index >= 0) list.splice(index, 1)
  else if (list.length < MAX_INGREDIENTS) list.push(name)
}

function addCustom(): void {
  try {
    const name = cleanText(custom.value, 'ingredient', { max: 30, required: true })
    if (!form.value.ingredients.includes(name) && form.value.ingredients.length < MAX_INGREDIENTS) form.value.ingredients.push(name)
    custom.value = ''
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error
  }
}

function previewSpell(name: string, effect: SpellEffectId, color: string, message: string): void {
  playEffect({ type: 'spell', effect, color, name, ...(message ? { message } : {}) }, 4200)
  playSfx('glass')
}

const save = useAction(async () => {
  await saveRecipe(form.value)
  await recipes.reload()
}, { success: 'Recipe saved to the table.' })

const cast = useAction(async (name: string, effect: SpellEffectId, color: string, message: string) => {
  await sendEvent('spell_cast', { effect, name, color, ...(message ? { message } : {}) })
  previewSpell(name, effect, color, message)
}, { success: 'Spell cast.' })

const remove = useAction(async (recipe: SpellRecipe) => {
  if (!window.confirm(`Delete the recipe “${recipe.name}”?`)) return
  await deleteRecipe(recipe.id)
  await recipes.reload()
})

const react = useAction(async (emoji: string) => {
  await sendEvent('love_ping', { reaction: 'custom', label: 'Loved your spell', emoji, animation: 'burst' })
}, { success: 'Reaction sent.' })

function load(recipe: SpellRecipe): void {
  form.value = { name: recipe.name, ingredients: [...recipe.ingredients], effect: recipe.effect, color: recipe.color, message: recipe.message }
}
</script>

<template>
  <PanelShell :title="definition.title" :icon="definition.icon" theme="spell" @close="$emit('close')">
    <div class="stack">
      <form class="stack" aria-label="Brew a spell" @submit.prevent="save.run()">
        <h3>Brew a spell</h3>
        <div class="field"><label for="spell-name">Name your spell</label><input id="spell-name" v-model="form.name" class="input" maxlength="40" required autocomplete="off" /></div>

        <fieldset class="shelf">
          <legend>Ingredients <span class="hint">({{ form.ingredients.length }} / {{ MAX_INGREDIENTS }})</span></legend>
          <div class="row">
            <button v-for="item in STARTER_INGREDIENTS" :key="item" type="button" class="btn btn--small" :aria-pressed="form.ingredients.includes(item)" :disabled="!form.ingredients.includes(item) && form.ingredients.length >= MAX_INGREDIENTS" @click="toggleIngredient(item)">{{ item }}</button>
          </div>
          <div class="row">
            <label class="visually-hidden" for="custom-ingredient">Your own ingredient</label>
            <input id="custom-ingredient" v-model="custom" class="input grow" maxlength="30" placeholder="Your own ingredient…" autocomplete="off" @keydown.enter.prevent="addCustom" />
            <button type="button" class="btn btn--small" @click="addCustom">Add</button>
          </div>
          <div v-if="form.ingredients.some((i) => !(STARTER_INGREDIENTS as readonly string[]).includes(i))" class="row">
            <button v-for="item in form.ingredients.filter((i) => !(STARTER_INGREDIENTS as readonly string[]).includes(i))" :key="item" type="button" class="btn btn--small is-active" :aria-label="`Remove ${item}`" @click="toggleIngredient(item)">{{ item }} ✕</button>
          </div>
        </fieldset>

        <fieldset class="shelf">
          <legend>Effect</legend>
          <div class="grid-2">
            <label v-for="effect in SPELL_EFFECTS" :key="effect.id" class="effect" :class="{ 'effect--on': form.effect === effect.id }">
              <input v-model="form.effect" class="visually-hidden" type="radio" name="effect" :value="effect.id" />
              <span aria-hidden="true">{{ effect.emoji }}</span> <span>{{ effect.label }}</span>
            </label>
          </div>
          <p class="hint">{{ effectInfo?.description }}</p>
        </fieldset>

        <div class="row">
          <div class="field"><label for="spell-color">Glow</label><input id="spell-color" v-model="form.color" type="color" class="color" /></div>
          <div class="field grow"><label for="spell-message">Whisper (optional)</label><input id="spell-message" v-model="form.message" class="input" maxlength="140" autocomplete="off" /></div>
        </div>

        <div class="row">
          <button type="button" class="btn btn--small" :disabled="!form.name.trim()" @click="previewSpell(form.name, form.effect, form.color, form.message)">Preview</button>
          <button type="button" class="btn btn--small btn--primary" :disabled="!form.name.trim() || cast.busy.value" @click="cast.run(form.name.trim(), form.effect, form.color, form.message)">Cast to {{ partnerName }}</button>
          <button type="submit" class="btn btn--small" :disabled="save.busy.value">Save recipe</button>
        </div>
      </form>

      <section class="stack" aria-labelledby="book-h">
        <h3 id="book-h">Recipe book</h3>
        <ResourceView :loading="recipes.loading.value" :error="recipes.error.value" @retry="recipes.reload">
          <EmptyState v-if="recipes.data.value.length === 0" emoji="📖" title="No recipes yet" hint="Brew one above and save it." />
          <template v-else>
            <ul class="plain" role="list">
              <li v-for="recipe in [...mine, ...theirs]" :key="recipe.id" class="card recipe">
                <div class="grow">
                  <p class="recipe__name"><span :style="{ color: recipe.color }" aria-hidden="true">{{ spellEffect(recipe.effect)?.emoji }}</span> {{ recipe.name }}</p>
                  <p class="hint">{{ recipe.ingredients.join(', ') || 'no ingredients' }}<template v-if="recipe.authorId !== session.userId"> · from {{ partnerName }}</template></p>
                </div>
                <button type="button" class="btn btn--small btn--primary" :disabled="cast.busy.value" @click="cast.run(recipe.name, recipe.effect, recipe.color, recipe.message)">Cast</button>
                <button type="button" class="btn btn--small btn--quiet" :aria-label="`Edit a copy of ${recipe.name}`" @click="load(recipe)">✎</button>
                <button v-if="recipe.authorId === session.userId" type="button" class="btn btn--small btn--quiet" :aria-label="`Delete ${recipe.name}`" @click="remove.run(recipe)">🗑</button>
              </li>
            </ul>
          </template>
        </ResourceView>
      </section>

      <section v-if="receivedSpells.length > 0" class="stack" aria-labelledby="recv-h">
        <h3 id="recv-h">Spells {{ partnerName }} cast at you</h3>
        <ul class="plain" role="list">
          <li v-for="entry in receivedSpells" :key="entry.id" class="card">
            <p>{{ entry.emoji }} {{ entry.text }}</p>
          </li>
        </ul>
        <div class="row" role="group" aria-label="React to their spell">
          <button v-for="chip in REACTION_CHIPS" :key="chip" type="button" class="btn btn--small" :disabled="react.busy.value" @click="react.run(chip)">{{ chip }}</button>
        </div>
      </section>
    </div>
  </PanelShell>
</template>

<style scoped>
.shelf { border: 1px solid var(--line-soft); border-radius: var(--radius-md); padding: var(--space-3); display: grid; gap: var(--space-2); margin: 0; }
.shelf legend { padding: 0 var(--space-2); font-weight: 700; color: var(--color-gold); }
.effect { display: flex; align-items: center; gap: var(--space-2); min-height: var(--tap-target); padding: 0 var(--space-3); border: 1px solid var(--line-soft); border-radius: var(--radius-md); cursor: pointer; font-size: var(--text-sm); }
.effect--on { border-color: var(--color-gold); background: color-mix(in srgb, var(--color-gold) 18%, transparent); }
.effect:focus-within { box-shadow: var(--focus-ring); }
.color { width: 56px; height: var(--tap-target); padding: 2px; border: 1px solid var(--line-soft); border-radius: var(--radius-sm); background: var(--surface-glass); }
.plain { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--space-2); }
.recipe { display: flex; gap: var(--space-2); align-items: center; }
.recipe__name { margin: 0; font-weight: 700; overflow-wrap: anywhere; }
.grow { flex: 1; min-width: 0; }
h3 { margin-top: var(--space-1); }
</style>

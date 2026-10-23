<script setup lang="ts">
import { nextTick, ref, useId } from 'vue'
import { interactionsInKeyboardOrder } from '@/registry/interactionRegistry'
import { unreadCounts } from '@/state/notes'

const emit = defineEmits<{ activate: [id: string]; focusObject: [id: string | null] }>()

const items = interactionsInKeyboardOrder()
const open = ref(false)
const menuId = useId()
const toggle = ref<HTMLButtonElement | null>(null)
const buttons = ref<HTMLButtonElement[]>([])

async function setOpen(value: boolean): Promise<void> {
  open.value = value
  if (!value) {
    emit('focusObject', null)
    return
  }
  await nextTick()
  buttons.value[0]?.focus()
}

function onMenuKey(event: KeyboardEvent, index: number): void {
  const last = items.length - 1
  const move = (next: number) => {
    event.preventDefault()
    buttons.value[(next + items.length) % items.length]?.focus()
  }
  if (event.key === 'ArrowDown') move(index + 1)
  else if (event.key === 'ArrowUp') move(index - 1)
  else if (event.key === 'Home') move(0)
  else if (event.key === 'End') move(last)
  else if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    void setOpen(false)
    toggle.value?.focus()
  }
}

function choose(id: string): void {
  void setOpen(false)
  emit('activate', id)
}
</script>

<template>
  <nav class="nav" aria-label="Room objects">
    <button ref="toggle" type="button" class="btn nav__toggle" :aria-expanded="open" :aria-controls="menuId" aria-haspopup="true" @click="setOpen(!open)">
      <span>Go to…</span><span aria-hidden="true">{{ open ? '▾' : '▴' }}</span>
    </button>
    <ul v-show="open" :id="menuId" class="nav__menu" role="list">
      <li v-for="(item, index) in items" :key="item.id">
        <button
          :ref="(el) => { if (el) buttons[index] = el as HTMLButtonElement }"
          type="button"
          class="btn nav__item"
          :aria-describedby="`${menuId}-${item.id}`"
          @click="choose(item.id)"
          @focus="emit('focusObject', item.id)"
          @mouseenter="emit('focusObject', item.id)"
          @keydown="onMenuKey($event, index)"
        >
          <span>{{ item.label }}</span>
          <span v-if="(unreadCounts.get(item.id) ?? 0) > 0" class="nav__badge" :aria-label="`${unreadCounts.get(item.id)} unread notes`">✉ {{ unreadCounts.get(item.id) }}</span>
        </button>
        <span :id="`${menuId}-${item.id}`" class="visually-hidden">{{ item.description }}</span>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.nav { position: relative; }
.nav__toggle { width: 100%; justify-content: space-between; font-size: var(--text-md); }
.nav__menu {
  position: absolute; left: 0; right: 0; bottom: calc(100% + var(--space-2)); margin: 0; padding: var(--space-2); list-style: none;
  display: grid; gap: var(--space-2); max-height: min(58dvh, 440px); overflow-y: auto; border: 1px solid var(--line-gold);
  border-radius: var(--radius-lg); background: var(--surface-panel); backdrop-filter: blur(14px); box-shadow: var(--shadow-panel);
}
.nav__item { width: 100%; justify-content: space-between; text-align: left; }
.nav__badge { font-size: var(--text-xs); color: var(--color-gold); }
</style>

<script setup lang="ts">
import { ref } from 'vue'

interface ListNode {
  id: number
  value: number
}

const nodes = ref<ListNode[]>([
  { id: 1, value: 12 },
  { id: 2, value: 99 },
  { id: 3, value: 37 },
])
const inputValue = ref(5)
const highlightedId = ref<number | null>(null)
const message = ref('A linked list is nodes pointing at the next node. Try each operation.')
let nextId = 4
let walkTimer: ReturnType<typeof setTimeout> | undefined

function recordOperation(description: string): void {
  message.value = description
}

function prepend(): void {
  nodes.value = [{ id: nextId++, value: inputValue.value }, ...nodes.value]
  recordOperation(`prepend(${inputValue.value}): O(1). Make a node and point it at the old head.`)
}

function append(): void {
  nodes.value = [...nodes.value, { id: nextId++, value: inputValue.value }]
  recordOperation(`append(${inputValue.value}): walk to the tail, then link it. O(n) without a tail pointer.`)
}

function removeValue(): void {
  const index = nodes.value.findIndex((node) => node.value === inputValue.value)
  if (index === -1) return recordOperation(`remove(${inputValue.value}): not found, so the list is unchanged.`)
  nodes.value = nodes.value.filter((_, position) => position !== index)
  recordOperation(`remove(${inputValue.value}): re-point the previous node past it.`)
}

function reverse(): void {
  nodes.value = [...nodes.value].reverse()
  recordOperation('reverse(): flip every next pointer, so the old tail becomes the head. O(n).')
}

function find(): void {
  clearTimeout(walkTimer)
  let position = 0
  const walk = (): void => {
    if (position >= nodes.value.length) {
      highlightedId.value = null
      return recordOperation(`find(${inputValue.value}): walked all ${nodes.value.length} nodes, not found.`)
    }
    const node = nodes.value[position]
    highlightedId.value = node.id
    if (node.value === inputValue.value) {
      return recordOperation(`find(${inputValue.value}): found after visiting ${position + 1} node(s).`)
    }
    position++
    walkTimer = setTimeout(walk, 450)
  }
  walk()
}
</script>

<template>
  <div class="viz">
    <div class="toolbar">
      <label>VALUE <input v-model.number="inputValue" type="number" /></label>
      <button class="btn is-green" @click="prepend">Prepend</button>
      <button class="btn is-green" @click="append">Append</button>
      <button class="btn is-amber" @click="removeValue">Remove</button>
      <button class="btn is-violet" @click="reverse">Reverse</button>
      <button class="btn is-ghost" @click="find">Find</button>
    </div>

    <div class="chain">
      <span class="head-tag">HEAD</span>
      <TransitionGroup name="node" tag="div" class="nodes">
        <div v-for="node in nodes" :key="node.id" class="node-wrap">
          <div class="node" :class="{ highlighted: highlightedId === node.id }">
            <span class="data">{{ node.value }}</span><span class="next">next</span>
          </div>
          <span class="arrow">&#10230;</span>
        </div>
      </TransitionGroup>
      <span class="null-tag">None</span>
    </div>

    <div class="console">&gt; {{ message }}</div>
  </div>
</template>

<style scoped>
.viz { display: flex; flex-direction: column; gap: 18px; }
.toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.toolbar label { display: flex; align-items: center; gap: 8px; font-size: 10px; letter-spacing: 0.18em; color: var(--text-dim); }
input[type='number'] { width: 80px; background: var(--hull-raised); color: var(--neon-amber); border: 1px solid var(--glass-edge); padding: 6px 8px; font-family: inherit; font-size: 15px; }
.chain { display: flex; align-items: center; gap: 12px; padding: 36px 20px; overflow-x: auto; background: rgba(4, 5, 10, 0.7); border: 1px solid rgba(25, 230, 255, 0.2); min-height: 140px; }
.nodes { display: flex; align-items: center; }
.node-wrap { display: flex; align-items: center; }
.node { display: flex; border: 1px solid var(--neon-cyan); transition: all 0.25s; }
.data { padding: 12px 18px; font-size: 20px; font-weight: 700; background: rgba(25, 230, 255, 0.12); }
.next { padding: 12px 10px; font-size: 10px; letter-spacing: 0.1em; color: var(--text-dim); border-left: 1px solid var(--neon-cyan); display: grid; place-items: center; }
.node.highlighted { border-color: var(--neon-amber); box-shadow: 0 0 calc(18px * var(--fx-scale)) var(--neon-amber); transform: translateY(-8px); }
.node.highlighted .data { background: rgba(255, 200, 61, 0.28); }
.arrow { padding: 0 10px; font-size: 22px; color: var(--neon-violet); }
.head-tag, .null-tag { font-size: 10px; letter-spacing: 0.25em; color: var(--neon-green); }
.null-tag { color: var(--text-dim); }
.console { padding: 10px 14px; color: var(--neon-cyan); background: rgba(4, 5, 10, 0.7); border-left: 3px solid var(--neon-cyan); min-height: 40px; }
.node-enter-active { animation: node-in 0.4s cubic-bezier(0.2, 1.5, 0.3, 1); }
.node-leave-active { transition: opacity 0.25s, transform 0.25s; position: absolute; }
.node-leave-to { opacity: 0; transform: translateY(30px); }
.node-move { transition: transform 0.4s; }
@keyframes node-in { from { opacity: 0; transform: translateY(calc(-34px * max(var(--fx-scale), 0.2))) scale(0.7); } to { opacity: 1; transform: none; } }
</style>

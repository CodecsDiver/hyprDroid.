<script setup lang="ts">
import { inject, ref, watch } from 'vue'
import { LAB_REPLAY_KEY } from '../../lab/replay'

const stack = ref<number[]>([3, 7])
const queue = ref<number[]>([3, 7])
const nextValue = ref(10)
const lastOperation = ref('Try pushing, popping, enqueueing and dequeueing.')

function countOperation(description: string): void {
  lastOperation.value = description
}

function takeValue(): number {
  return nextValue.value++
}

function push(): void {
  if (stack.value.length >= 8) return countOperation('The stack is full for this demo (8 items).')
  const value = takeValue()
  stack.value = [...stack.value, value]
  countOperation(`stack.append(${value})   # push: new item goes on top`)
}

function pop(): void {
  if (stack.value.length === 0) return countOperation('stack.pop() on an empty list raises IndexError')
  const value = stack.value.at(-1)
  stack.value = stack.value.slice(0, -1)
  countOperation(`stack.pop()  ->  ${value}   # last in, first out`)
}

function enqueue(): void {
  if (queue.value.length >= 8) return countOperation('The queue is full for this demo (8 items).')
  const value = takeValue()
  queue.value = [...queue.value, value]
  countOperation(`queue.append(${value})   # enqueue at the back`)
}

function dequeue(): void {
  if (queue.value.length === 0) return countOperation('Dequeue from an empty queue: nothing to take')
  const value = queue.value[0]
  queue.value = queue.value.slice(1)
  countOperation(`queue.popleft()  ->  ${value}   # first in, first out`)
}

const sleep = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
let demoToken = 0
const replayRequest = inject(LAB_REPLAY_KEY, null)
if (replayRequest) {
  // Plays a short scripted session so the finished lab shows both structures at work.
  watch(replayRequest, async () => {
    const token = ++demoToken
    stack.value = []
    queue.value = []
    for (const step of [push, push, push, pop, enqueue, enqueue, enqueue, dequeue, pop, dequeue]) {
      await sleep(450)
      if (token !== demoToken) return
      step()
    }
  })
}
</script>

<template>
  <div class="viz">
    <div class="structures">
      <section class="structure panel">
        <div class="panel-title">Stack &middot; LIFO</div>
        <div class="stack-box">
          <TransitionGroup name="item" tag="div" class="stack-items">
            <div v-for="(value, index) in stack" :key="value" class="item" :class="{ top: index === stack.length - 1 }">
              {{ value }}<span v-if="index === stack.length - 1" class="tag">TOP</span>
            </div>
          </TransitionGroup>
          <div v-if="stack.length === 0" class="empty">empty</div>
        </div>
        <div class="actions">
          <button class="btn is-green" @click="push">Push</button>
          <button class="btn is-amber" @click="pop">Pop</button>
        </div>
      </section>

      <section class="structure panel">
        <div class="panel-title">Queue &middot; FIFO</div>
        <div class="queue-box">
          <span class="end front">FRONT</span>
          <TransitionGroup name="item" tag="div" class="queue-items">
            <div v-for="(value, index) in queue" :key="value" class="item" :class="{ top: index === 0 }">{{ value }}</div>
          </TransitionGroup>
          <span class="end back">BACK</span>
          <div v-if="queue.length === 0" class="empty">empty</div>
        </div>
        <div class="actions">
          <button class="btn is-green" @click="enqueue">Enqueue</button>
          <button class="btn is-amber" @click="dequeue">Dequeue</button>
        </div>
      </section>
    </div>
    <div class="console">&gt; {{ lastOperation }}</div>
  </div>
</template>

<style scoped>
.viz { display: flex; flex-direction: column; gap: 16px; }
.structures { display: grid; grid-template-columns: 1fr 2fr; gap: 16px; }
.structure { padding-bottom: 14px; background: rgb(var(--void-rgb) / 0.7); }
.stack-box { display: flex; align-items: flex-end; justify-content: center; min-height: 360px; padding: 16px; position: relative; }
.stack-items { display: flex; flex-direction: column-reverse; gap: 6px; width: 140px; }
.queue-box { display: flex; align-items: center; gap: 12px; min-height: 150px; padding: 16px; position: relative; }
.queue-items { display: flex; gap: 6px; flex: 1; justify-content: center; }
.item { position: relative; display: grid; place-items: center; min-width: 54px; height: 44px; padding: 0 14px; font-size: 17px; font-weight: 700; background: rgb(var(--neon-violet-rgb) / 0.2); border: 1px solid var(--neon-violet); transition: all 0.25s; }
.item.top { background: rgb(var(--neon-green-rgb) / 0.2); border-color: var(--neon-green); box-shadow: var(--glow-green); }
.tag { position: absolute; left: calc(100% + 10px); font-size: 9px; letter-spacing: 0.2em; color: var(--neon-green); }
.end { font-size: 9px; letter-spacing: 0.25em; color: var(--text-dim); }
.empty { position: absolute; inset: 0; display: grid; place-items: center; color: var(--text-dim); letter-spacing: 0.3em; pointer-events: none; }
.actions { display: flex; justify-content: center; gap: 12px; }
.console { padding: 10px 14px; color: var(--neon-cyan); background: rgb(var(--void-rgb) / 0.7); border-left: 3px solid var(--neon-cyan); min-height: 40px; }
.item-enter-active { animation: item-in 0.35s cubic-bezier(0.2, 1.5, 0.3, 1); }
.item-leave-active { transition: opacity 0.2s, transform 0.2s; position: absolute; }
.item-leave-to { opacity: 0; transform: translateY(-20px) scale(0.8); }
@keyframes item-in { from { opacity: 0; transform: translateY(calc(-30px * max(var(--fx-scale), 0.2))) scale(0.7); } to { opacity: 1; transform: none; } }
</style>

<script setup lang="ts">
import { ref } from 'vue'
import { resizedSize } from '../../layout/resize'

const props = defineProps<{
  /** `vertical` is a bar that resizes widths (drag left/right); `horizontal` resizes heights. */
  orientation: 'vertical' | 'horizontal'
  size: number
  min: number
  max: number
  defaultSize: number
  /** True when the handle sits on the leading edge of the panel it resizes (right panel, bottom panel). */
  invert?: boolean
  label: string
}>()
const emit = defineEmits<{ 'update:size': [size: number] }>()

const isDragging = ref(false)
let startPointer = 0
let startSize = 0
const KEYBOARD_STEP = 16

const pointerPosition = (event: PointerEvent) => (props.orientation === 'vertical' ? event.clientX : event.clientY)

function onPointerDown(event: PointerEvent): void {
  isDragging.value = true
  startPointer = pointerPosition(event)
  startSize = props.size
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  document.body.style.cursor = props.orientation === 'vertical' ? 'col-resize' : 'row-resize'
  document.body.style.userSelect = 'none'
  event.preventDefault()
}

function onPointerMove(event: PointerEvent): void {
  if (!isDragging.value) return
  emit('update:size', resizedSize(startSize, pointerPosition(event) - startPointer, !!props.invert, props.min, props.max))
}

function onPointerUp(event: PointerEvent): void {
  if (!isDragging.value) return
  isDragging.value = false
  ;(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

function onKeydown(event: KeyboardEvent): void {
  const growKey = props.orientation === 'vertical' ? (props.invert ? 'ArrowLeft' : 'ArrowRight') : props.invert ? 'ArrowUp' : 'ArrowDown'
  const shrinkKey = props.orientation === 'vertical' ? (props.invert ? 'ArrowRight' : 'ArrowLeft') : props.invert ? 'ArrowDown' : 'ArrowUp'
  if (event.key !== growKey && event.key !== shrinkKey) return
  event.preventDefault()
  const direction = event.key === growKey ? 1 : -1
  emit('update:size', resizedSize(props.size, direction * KEYBOARD_STEP, false, props.min, props.max))
}
</script>

<template>
  <div
    class="resize-handle"
    :class="[orientation, { dragging: isDragging }]"
    role="separator"
    :aria-orientation="orientation"
    :aria-label="label"
    :aria-valuenow="size"
    :aria-valuemin="min"
    :aria-valuemax="max"
    tabindex="0"
    :title="`Drag to resize ${label}. Double-click to reset.`"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @dblclick="emit('update:size', defaultSize)"
    @keydown="onKeydown"
  >
    <span class="grip" />
  </div>
</template>

<style scoped>
.resize-handle { position: relative; z-index: 3; display: grid; place-items: center; touch-action: none; outline: none; }
.resize-handle.vertical { width: 12px; margin: 0 -3px; cursor: col-resize; }
.resize-handle.horizontal { height: 12px; margin: -3px 0; cursor: row-resize; }
.grip {
  background: rgb(var(--neon-cyan-rgb) / 0.28);
  border-radius: 2px;
  transition: background 0.15s, box-shadow 0.15s;
}
.vertical .grip { width: 3px; height: 46px; }
.horizontal .grip { height: 3px; width: 46px; }
.resize-handle:hover .grip,
.resize-handle:focus-visible .grip,
.resize-handle.dragging .grip { background: var(--neon-cyan); box-shadow: var(--glow-cyan); }
.vertical:hover .grip, .vertical.dragging .grip { height: 90px; }
.horizontal:hover .grip, .horizontal.dragging .grip { width: 90px; }
</style>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { downscaleImage } from '@/data/imageTools'
import { addSticker, deleteSticker, type Sticker } from '@/data/repos/loveUniverse'
import { session } from '@/state/session'
import { refreshStickers, stickers, stickerVisual, type StickerVisual } from '@/state/stickers'
import { useAction } from '@/state/useAsync'

const emit = defineEmits<{ pick: [sticker: Sticker, visual: StickerVisual] }>()

const visuals = ref<Record<string, StickerVisual>>({})
const label = ref('')
const image = ref<File | null>(null)
const adding = ref(false)

async function resolveAll(): Promise<void> {
  for (const sticker of stickers.value) {
    if (visuals.value[sticker.id]) continue
    try {
      visuals.value = { ...visuals.value, [sticker.id]: stickerVisual(sticker) }
    } catch {
      /* unavailable sticker: skip */
    }
  }
}
onMounted(async () => {
  await refreshStickers().catch(() => {})
  await resolveAll()
})
watch(stickers, () => void resolveAll())

const upload = useAction(async () => {
  if (!image.value) throw Object.assign(new Error('Choose an image first.'), { name: 'ValidationError' })
  const small = await downscaleImage(image.value, 512, 0.9)
  await addSticker(label.value, small)
  label.value = ''
  image.value = null
  adding.value = false
  await refreshStickers()
}, { success: 'Sticker added.' })

const remove = useAction(async (sticker: Sticker) => {
  if (!window.confirm(`Delete the sticker “${sticker.label}”?`)) return
  await deleteSticker(sticker.id)
  await refreshStickers()
})
</script>

<template>
  <section class="stickers" aria-label="Stickers">
    <p v-if="stickers.length === 0" class="hint">No stickers yet. Add your own below — any picture can be a sticker.</p>
    <ul class="grid" role="list">
      <li v-for="sticker in stickers" :key="sticker.id" class="cell">
        <button type="button" class="pick" :aria-label="`Send sticker: ${sticker.label}`" :disabled="!visuals[sticker.id]" @click="visuals[sticker.id] && emit('pick', sticker, visuals[sticker.id]!)">
          <span class="art" :style="visuals[sticker.id]?.style" role="img" :aria-label="sticker.label" />
        </button>
        <button v-if="sticker.ownerId === session.userId && !sticker.sprite" type="button" class="del" :aria-label="`Delete sticker ${sticker.label}`" @click="remove.run(sticker)">✕</button>
      </li>
    </ul>
    <button type="button" class="btn btn--small" :aria-expanded="adding" @click="adding = !adding">{{ adding ? 'Cancel' : '＋ Add a sticker' }}</button>
    <form v-if="adding" class="stack add" @submit.prevent="upload.run()">
      <div class="field"><label for="st-label">Name</label><input id="st-label" v-model="label" class="input" maxlength="40" required /></div>
      <div class="field"><label for="st-img">Picture (JPEG, PNG or WebP)</label><input id="st-img" type="file" accept="image/jpeg,image/png,image/webp" required @change="image = ($event.target as HTMLInputElement).files?.[0] ?? null" /></div>
      <button type="submit" class="btn btn--small btn--primary" :disabled="upload.busy.value">Add sticker</button>
    </form>
  </section>
</template>

<style scoped>
.stickers { display: grid; gap: var(--space-2); text-align: left; }
.grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: var(--space-2); max-height: 38dvh; overflow-y: auto; }
.cell { position: relative; }
.pick { width: 100%; padding: 4px; border: 1px solid var(--line-soft); border-radius: var(--radius-sm); background: var(--surface-glass); min-height: var(--tap-target); }
.pick:disabled { opacity: 0.4; }
.art { display: block; width: 100%; aspect-ratio: 4 / 3; border-radius: 8px; }
.del { position: absolute; top: -4px; right: -4px; width: 26px; height: 26px; border-radius: 50%; border: 1px solid var(--line-soft); background: rgba(0, 0, 0, 0.7); color: var(--color-ink); font-size: 12px; }
.add { padding: var(--space-2); border: 1px solid var(--line-soft); border-radius: var(--radius-md); }
</style>

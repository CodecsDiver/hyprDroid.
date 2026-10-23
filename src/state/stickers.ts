import { ref } from 'vue'
import { fetchStickers, type Sticker } from '@/data/repos/loveUniverse'
import { fileUrl } from '@/data/files'
import { spriteStyle } from '@/domain/loveUniverse'

export const stickers = ref<Sticker[]>([])

export async function refreshStickers(): Promise<void> {
  stickers.value = await fetchStickers()
}

export interface StickerVisual {
  url: string
  style: Record<string, string>
}

/** Resolves a sticker (whole image or one sprite-sheet cell) to a URL plus CSS. */
export function stickerVisual(sticker: Sticker): StickerVisual {
  const url = fileUrl(sticker.fileId)
  const style = sticker.sprite
    ? spriteStyle(sticker.sprite, url)
    : { backgroundImage: `url("${url.replace(/"/g, '%22')}")`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }
  return { url, style }
}

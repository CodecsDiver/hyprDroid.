import { onMounted, ref } from 'vue'
import { DEFAULT_MANIFEST, createAssetResolver, type AssetManifest, type AssetResolver } from '@/assets/manifest'

let manifest: AssetManifest = DEFAULT_MANIFEST
let resolver: AssetResolver = createAssetResolver(async () => {
  throw new Error('private assets need a signed-in session')
})

export function provideAssets(next: { manifest: AssetManifest; resolver: AssetResolver }): void {
  manifest = next.manifest
  resolver = next.resolver
}

/** Resolves a UI image from the manifest; `url` stays null (and the UI keeps its built-in fallback) until one is provided. */
export function useManifestImage(id: string) {
  const url = ref<string | null>(null)
  const alt = ref('')
  onMounted(async () => {
    const image = manifest.images[id]
    if (!image?.source) return
    try {
      url.value = await resolver.url(image.source)
      alt.value = image.alt
    } catch {
      url.value = null
    }
  })
  return { url, alt }
}

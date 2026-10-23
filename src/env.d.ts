/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_SCENE_PREVIEW?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module 'virtual:private-seed' {
  import type { PrivateSeed } from '@/local/seed'
  const seed: PrivateSeed | null
  export default seed
}

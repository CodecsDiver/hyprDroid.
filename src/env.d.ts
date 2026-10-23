/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_SCENE_PREVIEW?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

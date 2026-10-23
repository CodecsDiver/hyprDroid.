import { createApp } from 'vue'
import App from './App.vue'
import { readConfig } from './config/env'
import { listenForInstallPrompt } from './state/install'
import { applyMotionAttribute } from './state/prefs'
import './styles/base.css'
import './styles/effects.css'

applyMotionAttribute()
listenForInstallPrompt()

const config = readConfig(import.meta.env)
// The backend-free scene preview exists for design/QA of the 3D room; it is off in production unless opted in.
const previewEnabled = import.meta.env.DEV || import.meta.env.VITE_ENABLE_SCENE_PREVIEW === '1'

createApp(App, { config, previewEnabled }).mount('#app')

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => console.warn('[pwa] service worker registration failed', error))
  })
}

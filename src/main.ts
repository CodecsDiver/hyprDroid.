import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { emitJuice } from './juice/juiceBus'
import { registerServiceWorker } from './pwa/registerServiceWorker'
import './styles/realm.css'

const pinia = createPinia()
createApp(App).use(pinia).mount('#app')

window.addEventListener('load', () => void registerServiceWorker())

if (import.meta.env.DEV) {
  // Development-only handle for driving effects from the browser console or automated screenshots.
  Object.assign(window, { __pydisc: { pinia, emitJuice } })
}

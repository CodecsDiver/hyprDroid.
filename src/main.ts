import { createApp } from 'vue'
import App from './App.vue'
import { listenForInstallPrompt } from './state/install'
import { applyMotionAttribute } from './state/prefs'
import './styles/base.css'
import './styles/effects.css'

applyMotionAttribute()
listenForInstallPrompt()

// The backend-free scene preview exists for design/QA of the 3D room; it is off in production unless opted in.
const previewEnabled = import.meta.env.DEV || import.meta.env.VITE_ENABLE_SCENE_PREVIEW === '1'

createApp(App, { previewEnabled }).mount('#app')

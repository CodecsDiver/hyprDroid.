<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import ErrorBoundary from '@/components/ErrorBoundary.vue'
import LoadingState from '@/components/LoadingState.vue'
import ToastHost from '@/components/ToastHost.vue'
import { createAssetResolver, DEFAULT_MANIFEST } from '@/assets/manifest'
import { configureAudio } from '@/audio/engine'
import { fileUrl } from '@/data/files'
import { provideAssets } from '@/state/assets'
import AuthScreen from '@/screens/AuthScreen.vue'
import HomeScene from '@/screens/HomeScene.vue'
import ScenePreview from '@/screens/ScenePreview.vue'
import { home, loadHome, resetHome } from '@/state/household'
import { initSession, session } from '@/state/session'

const props = defineProps<{ previewEnabled: boolean }>()

const wantsPreview = computed(() => props.previewEnabled && location.hash === '#/scene-preview')

onMounted(async () => {
  const resolver = createAssetResolver(fileUrl)
  provideAssets({ manifest: DEFAULT_MANIFEST, resolver })
  configureAudio({ manifest: DEFAULT_MANIFEST, resolver })
  if (!wantsPreview.value) await initSession()
})

watch(() => session.me?.user.id ?? null, (userId) => {
  if (userId && session.me) void loadHome(session.me.user, session.me.partner)
  else resetHome()
})
</script>

<template>
  <ErrorBoundary label="Signal Home">
    <ScenePreview v-if="wantsPreview" />
    <LoadingState v-else-if="session.status === 'loading' || (session.status === 'signedIn' && (home.status === 'idle' || home.status === 'loading'))" label="Opening the door…" />
    <AuthScreen v-else-if="session.status === 'signedOut'" />
    <main v-else-if="home.status === 'error'" class="fail">
      <p role="alert">{{ home.error }}</p>
      <button type="button" class="btn" @click="session.me && loadHome(session.me.user, session.me.partner)">Try again</button>
    </main>
    <HomeScene v-else />
    <ToastHost />
  </ErrorBoundary>
</template>

<style scoped>
.fail { height: 100%; display: grid; place-content: center; gap: var(--space-3); text-align: center; padding: var(--gutter); }
</style>

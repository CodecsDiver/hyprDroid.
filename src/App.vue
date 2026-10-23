<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import ErrorBoundary from '@/components/ErrorBoundary.vue'
import LoadingState from '@/components/LoadingState.vue'
import ToastHost from '@/components/ToastHost.vue'
import type { ConfigResult } from '@/config/env'
import { createAssetResolver, DEFAULT_MANIFEST } from '@/assets/manifest'
import { configureAudio } from '@/audio/engine'
import { clearSignedUrlCache, signedUrl } from '@/data/storage'
import { initSupabase } from '@/data/supabase'
import AuthScreen from '@/screens/AuthScreen.vue'
import HomeScene from '@/screens/HomeScene.vue'
import HouseholdSetup from '@/screens/HouseholdSetup.vue'
import ScenePreview from '@/screens/ScenePreview.vue'
import SetupRequired from '@/screens/SetupRequired.vue'
import { home, loadHome, resetHome } from '@/state/household'
import { initSession, session } from '@/state/session'

const props = defineProps<{ config: ConfigResult; previewEnabled: boolean }>()

const wantsPreview = computed(() => props.previewEnabled && location.hash === '#/scene-preview')

onMounted(async () => {
  if (!props.config.ok) return
  initSupabase(props.config.config)
  configureAudio({ manifest: DEFAULT_MANIFEST, resolver: createAssetResolver(signedUrl) })
  await initSession()
})

watch(() => [session.status, session.userId] as const, ([status, userId]) => {
  if (status === 'signedIn' && userId) void loadHome(userId)
  else if (status === 'signedOut') {
    resetHome()
    clearSignedUrlCache() // no private-media URLs survive a sign-out
  }
})
</script>

<template>
  <ErrorBoundary label="Signal Home">
    <ScenePreview v-if="wantsPreview" />
    <SetupRequired v-else-if="!config.ok" :problems="config.problems" />
    <LoadingState v-else-if="session.status === 'loading' || (session.status === 'signedIn' && (home.status === 'idle' || home.status === 'loading'))" label="Opening the door…" />
    <AuthScreen v-else-if="session.status === 'signedOut'" />
    <main v-else-if="home.status === 'error'" class="fail">
      <p role="alert">{{ home.error }}</p>
      <button type="button" class="btn" @click="session.userId && loadHome(session.userId)">Try again</button>
    </main>
    <HouseholdSetup v-else-if="home.status === 'none'" />
    <HomeScene v-else />
    <ToastHost />
  </ErrorBoundary>
</template>

<style scoped>
.fail { height: 100%; display: grid; place-content: center; gap: var(--space-3); text-align: center; padding: var(--gutter); }
</style>

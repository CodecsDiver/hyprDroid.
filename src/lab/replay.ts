import type { InjectionKey, Ref } from 'vue'

/**
 * The lab bumps this counter to ask the visualizer on screen to play its animation from the start.
 * Visualizers that do not care simply never inject it.
 */
export const LAB_REPLAY_KEY: InjectionKey<Ref<number>> = Symbol('labReplay')

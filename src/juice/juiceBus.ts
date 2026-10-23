export type JuiceEvent =
  | { kind: 'keystroke'; x: number; y: number; combo: number }
  | { kind: 'combo-milestone'; combo: number }
  | { kind: 'combo-broken'; combo: number }
  | { kind: 'saved' }
  | { kind: 'run-started' }
  | { kind: 'xp-gained'; amount: number }
  | { kind: 'objective-met'; title: string }
  | { kind: 'objective-failed' }
  | { kind: 'quest-completed'; title: string; rewardXp: number }
  | { kind: 'achievement-unlocked'; title: string }
  | { kind: 'level-up'; level: number; rank: string }
  | { kind: 'project-completed'; title: string }

type JuiceListener = (event: JuiceEvent) => void
const listeners = new Set<JuiceListener>()

export function emitJuice(event: JuiceEvent): void {
  listeners.forEach((listener) => listener(event))
}

export function onJuice(listener: JuiceListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

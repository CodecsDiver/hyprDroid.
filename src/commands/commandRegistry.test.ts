import { describe, expect, it } from 'vitest'
import { fuzzyScore, matchesShortcut, searchCommands, type AppCommand } from './commandRegistry'

const key = (init: Partial<KeyboardEventInit> & { key: string }) => ({
  ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...init,
})

describe('matchesShortcut', () => {
  it('matches Ctrl or Cmd with the right key and modifiers only', () => {
    expect(matchesShortcut(key({ key: 's', ctrlKey: true }), 'Ctrl+S')).toBe(true)
    expect(matchesShortcut(key({ key: 's', metaKey: true }), 'Ctrl+S')).toBe(true)
    expect(matchesShortcut(key({ key: 's' }), 'Ctrl+S')).toBe(false)
    expect(matchesShortcut(key({ key: 'S', ctrlKey: true, shiftKey: true }), 'Ctrl+S')).toBe(false)
    expect(matchesShortcut(key({ key: 'P', ctrlKey: true, shiftKey: true }), 'Ctrl+Shift+P')).toBe(true)
    expect(matchesShortcut(key({ key: 'F1' }), 'F1')).toBe(true)
  })

  it('handles symbol keys regardless of how shift is reported', () => {
    expect(matchesShortcut(key({ key: '=', ctrlKey: true }), 'Ctrl+=')).toBe(true)
    expect(matchesShortcut(key({ key: '-', ctrlKey: true }), 'Ctrl+-')).toBe(true)
    expect(matchesShortcut(key({ key: '0', ctrlKey: true }), 'Ctrl+0')).toBe(true)
  })
})

describe('command search', () => {
  const commands = ['Save', 'Save as copy', 'Toggle Focus mode', 'Run', 'Check my work'].map(
    (title) => ({ id: title, title, category: 'File', run: () => undefined }) as AppCommand,
  )

  it('matches subsequences and ranks tighter matches first', () => {
    expect(fuzzyScore('tfm', 'Toggle Focus mode')).toBeGreaterThan(0)
    expect(fuzzyScore('zzz', 'Toggle Focus mode')).toBe(-1)
    expect(searchCommands(commands, 'save')[0].title).toBe('Save')
    expect(searchCommands(commands, 'focus').map((c) => c.title)).toEqual(['Toggle Focus mode'])
  })

  it('returns everything for an empty query', () => {
    expect(searchCommands(commands, '')).toHaveLength(commands.length)
  })
})

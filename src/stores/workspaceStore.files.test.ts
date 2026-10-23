import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { PROJECTS } from '../curriculum/projects'
import { useWorkspaceStore } from './workspaceStore'

const storage = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
    removeItem: (key: string) => void storage.delete(key),
    key: (index: number) => [...storage.keys()][index] ?? null,
    get length() {
      return storage.size
    },
  },
})

const fileKey = (project: string, name: string) => `pydisc-web:file:${project}/${name}`
const first = PROJECTS[0]

async function freshWorkspace() {
  setActivePinia(createPinia())
  const workspace = useWorkspaceStore()
  await workspace.initialize()
  return workspace
}

beforeEach(() => storage.clear())

describe('multiple files in a mission', () => {
  it('starts with just main.py holding the starter code', async () => {
    const workspace = await freshWorkspace()
    expect(workspace.fileNames).toEqual(['main.py'])
    expect(workspace.activeFileName).toBe('main.py')
    expect(workspace.code).toBe(first.starterCode)
  })

  it('creates a new empty file, adds .py, opens it and persists it', async () => {
    const workspace = await freshWorkspace()
    expect(await workspace.createFile('helpers')).toBeNull()
    expect(workspace.fileNames).toEqual(['main.py', 'helpers.py'])
    expect(workspace.activeFileName).toBe('helpers.py')
    expect(workspace.code).toBe('')
    expect(storage.get(fileKey(first.id, 'helpers.py'))).toBe('')
  })

  it('saves edits to the file being edited, not to main.py', async () => {
    const workspace = await freshWorkspace()
    await workspace.createFile('helpers.py')
    workspace.updateCode('def double(x):\n    return x * 2\n')
    expect(workspace.isDirty).toBe(true)
    expect(await workspace.save({ manual: false })).toBe(true)
    expect(workspace.isDirty).toBe(false)
    expect(storage.get(fileKey(first.id, 'helpers.py'))).toContain('def double')
    expect(storage.get(fileKey(first.id, 'main.py'))).toBe(first.starterCode)
  })

  it('saves unsaved edits when switching files and restores each file exactly', async () => {
    const workspace = await freshWorkspace()
    await workspace.createFile('helpers.py')
    workspace.updateCode('X = 1\n')
    await workspace.openFile('main.py')
    expect(workspace.activeFileName).toBe('main.py')
    expect(workspace.code).toBe(first.starterCode)
    expect(storage.get(fileKey(first.id, 'helpers.py'))).toBe('X = 1\n')
    await workspace.openFile('helpers.py')
    expect(workspace.code).toBe('X = 1\n')
    expect(workspace.isDirty).toBe(false)
  })

  it('rejects duplicate and invalid names with a reason', async () => {
    const workspace = await freshWorkspace()
    expect(await workspace.createFile('main')).toContain('already exists')
    expect(await workspace.createFile('../evil')).not.toBeNull()
    expect(await workspace.createFile('has space')).not.toBeNull()
    expect(workspace.fileNames).toEqual(['main.py'])
  })

  it('renames a file, moving its content and following it if active', async () => {
    const workspace = await freshWorkspace()
    await workspace.createFile('helpers.py')
    workspace.updateCode('Y = 2\n')
    expect(await workspace.renameFile('helpers.py', 'utils')).toBeNull()
    expect(workspace.fileNames).toEqual(['main.py', 'utils.py'])
    expect(workspace.activeFileName).toBe('utils.py')
    expect(storage.get(fileKey(first.id, 'utils.py'))).toBe('Y = 2\n')
    expect(storage.has(fileKey(first.id, 'helpers.py'))).toBe(false)
  })

  it('deletes a file and falls back to main.py, but protects main.py', async () => {
    const workspace = await freshWorkspace()
    await workspace.createFile('helpers.py')
    expect(await workspace.deleteFile('helpers.py')).toBeNull()
    expect(workspace.fileNames).toEqual(['main.py'])
    expect(workspace.activeFileName).toBe('main.py')
    expect(workspace.code).toBe(first.starterCode)
    expect(storage.has(fileKey(first.id, 'helpers.py'))).toBe(false)
    expect(await workspace.deleteFile('main.py')).toContain('cannot be deleted')
    expect(await workspace.renameFile('main.py', 'other')).toContain('cannot be renamed')
    expect(storage.has(fileKey(first.id, 'main.py'))).toBe(true)
  })

  it('remembers the files after a restart, per mission', async () => {
    const workspace = await freshWorkspace()
    await workspace.createFile('helpers.py')
    await workspace.selectProject(PROJECTS[1].id)
    expect(workspace.fileNames).toEqual(['main.py'])
    await workspace.createFile('numbers_extra.py')

    const afterRestart = await freshWorkspace()
    expect(afterRestart.fileNames).toEqual(['main.py', 'helpers.py'])
    await afterRestart.selectProject(PROJECTS[1].id)
    expect(afterRestart.fileNames).toEqual(['main.py', 'numbers_extra.py'])
  })

  it('resets only main.py to its starter code', async () => {
    const workspace = await freshWorkspace()
    workspace.updateCode('print("mine")\n')
    await workspace.save({ manual: false })
    await workspace.createFile('helpers.py')
    workspace.updateCode('KEEP = True\n')
    await workspace.resetToStarter()
    expect(workspace.activeFileName).toBe('main.py')
    expect(workspace.code).toBe(first.starterCode)
    expect(storage.get(fileKey(first.id, 'helpers.py'))).toBe('KEEP = True\n')
  })
})

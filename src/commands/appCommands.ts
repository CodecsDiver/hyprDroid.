import { isNativeRuntime, toBackendError } from '../backend/backend'
import { MAIN_FILE_NAME, PROJECTS } from '../curriculum/projects'
import { useProgressionStore } from '../stores/progressionStore'
import { useSettingsStore, type AnimationIntensity } from '../stores/settingsStore'
import { useUiStore } from '../stores/uiStore'
import { useWorkspaceStore } from '../stores/workspaceStore'
import type { AppCommand } from './commandRegistry'
import { requestDelete, requestNewFile, requestRename } from './fileActions'
import { visualizeActiveFile } from './visualizeAction'
import { downloadTextFile, pickTextFile } from './fileTransfer'

export interface CommandContext {
  editorAction(actionId: string): void
  focusEditor(): void
  openLab(): Promise<void>
  closeWindow(): void
}

const INTENSITIES: AnimationIntensity[] = ['off', 'low', 'medium', 'high']

/** Builds the full command list. Must be called inside a component's setup so the stores resolve. */
export function buildAppCommands(context: CommandContext): AppCommand[] {
  const settings = useSettingsStore()
  const workspace = useWorkspaceStore()
  const ui = useUiStore()
  const progression = useProgressionStore()

  const editorCommand = (
    id: string,
    title: string,
    category: AppCommand['category'],
    shortcut: string,
    actionId: string,
  ): AppCommand => ({
    id, title, category, shortcuts: [shortcut], handledByEditor: true, run: () => context.editorAction(actionId),
  })

  async function importFile(): Promise<void> {
    try {
      const picked = await pickTextFile('.py,text/x-python,text/plain')
      if (!picked) return
      const hasWork = workspace.code.trim() !== '' && workspace.code !== workspace.selectedProject.starterCode
      if (hasWork && !(await ui.confirm('Replace editor contents?', `${picked.name} will replace the code in ${MAIN_FILE_NAME} (you can undo with Ctrl+Z).`, 'Replace'))) return
      workspace.updateCode(picked.text)
      context.focusEditor()
    } catch (error) {
      workspace.reportError(toBackendError(error))
    }
  }

  async function resetMission(): Promise<void> {
    const confirmed = await ui.confirm('Reset mission code?', `main.py in ${workspace.selectedProject.title} goes back to its starter code. Objectives you already cleared stay cleared.`, 'Reset')
    if (!confirmed) return
    await workspace.resetToStarter()
    context.focusEditor()
  }

  const commands: AppCommand[] = [
    { id: 'file.new', title: 'New file...', category: 'File', shortcuts: ['Ctrl+Alt+N'], run: () => requestNewFile() },
    { id: 'file.save', title: 'Save', category: 'File', shortcuts: ['Ctrl+S'], run: () => void workspace.save({ manual: true }), isEnabled: () => workspace.isDirty },
    { id: 'file.import', title: 'Import .py file...', category: 'File', shortcuts: ['Ctrl+O'], run: importFile },
    {
      id: 'file.export', title: 'Export code as .py', category: 'File', shortcuts: ['Ctrl+Shift+S'],
      run: () => downloadTextFile(workspace.activeFileName, workspace.code),
      isEnabled: () => !isNativeRuntime(),
    },
    { id: 'file.rename', title: 'Rename current file...', category: 'File', shortcuts: ['F2'], run: () => requestRename(workspace.activeFileName), isEnabled: () => !workspace.isProtectedFile(workspace.activeFileName) },
    { id: 'file.delete', title: 'Delete current file...', category: 'File', run: () => requestDelete(workspace.activeFileName), isEnabled: () => !workspace.isProtectedFile(workspace.activeFileName) },
    { id: 'file.reset', title: 'Reset main.py to starter code...', category: 'File', run: resetMission },
    { id: 'file.lab', title: 'Open Visualizer Lab', category: 'File', shortcuts: ['Ctrl+Alt+L'], run: () => context.openLab() },
    { id: 'file.close', title: 'Close window', category: 'File', run: () => context.closeWindow(), isEnabled: () => isNativeRuntime() },

    editorCommand('edit.undo', 'Undo', 'Edit', 'Ctrl+Z', 'undo'),
    editorCommand('edit.redo', 'Redo', 'Edit', 'Ctrl+Shift+Z', 'redo'),
    editorCommand('edit.cut', 'Cut', 'Edit', 'Ctrl+X', 'editor.action.clipboardCutAction'),
    editorCommand('edit.copy', 'Copy', 'Edit', 'Ctrl+C', 'editor.action.clipboardCopyAction'),
    editorCommand('edit.selectAll', 'Select all', 'Edit', 'Ctrl+A', 'editor.action.selectAll'),
    editorCommand('edit.find', 'Find', 'Edit', 'Ctrl+F', 'actions.find'),
    editorCommand('edit.replace', 'Replace', 'Edit', 'Ctrl+H', 'editor.action.startFindReplace'),
    editorCommand('edit.comment', 'Toggle line comment', 'Edit', 'Ctrl+/', 'editor.action.commentLine'),
    editorCommand('edit.gotoLine', 'Go to line...', 'Edit', 'Ctrl+G', 'editor.action.gotoLine'),

    { id: 'view.palette', title: 'Command palette...', category: 'View', shortcuts: ['F1', 'Ctrl+Shift+P'], run: () => ui.openPalette() },
    { id: 'view.missions', title: 'Missions panel', category: 'View', shortcuts: ['Ctrl+B'], run: () => (settings.panels.missions = !settings.panels.missions), isChecked: () => settings.panels.missions },
    { id: 'view.quests', title: 'Quests panel', category: 'View', shortcuts: ['Ctrl+Alt+B'], run: () => (settings.panels.quests = !settings.panels.quests), isChecked: () => settings.panels.quests },
    { id: 'view.output', title: 'Output panel', category: 'View', shortcuts: ['Ctrl+J'], run: () => (settings.panels.output = !settings.panels.output), isChecked: () => settings.panels.output },
    { id: 'view.focus', title: 'Focus mode', category: 'View', shortcuts: ['Ctrl+Shift+F'], run: () => (settings.focusMode = !settings.focusMode), isChecked: () => settings.focusMode },
    { id: 'view.zoomIn', title: 'Zoom in (increase editor font size)', category: 'View', shortcuts: ['Ctrl+='], run: () => settings.changeEditorFontSize(1) },
    { id: 'view.zoomOut', title: 'Zoom out (decrease editor font size)', category: 'View', shortcuts: ['Ctrl+-'], run: () => settings.changeEditorFontSize(-1) },
    { id: 'view.zoomReset', title: 'Zoom reset (editor font size)', category: 'View', shortcuts: ['Ctrl+0'], run: () => (settings.editorFontSize = 15) },
    ...INTENSITIES.map((level): AppCommand => ({
      id: `view.fx.${level}`,
      title: `Animation intensity: ${level[0].toUpperCase()}${level.slice(1)}`,
      category: 'View',
      run: () => (settings.animationIntensity = level),
      isChecked: () => settings.animationIntensity === level,
    })),
    { id: 'view.sound', title: 'Sound effects', category: 'View', run: () => (settings.soundEnabled = !settings.soundEnabled), isChecked: () => settings.soundEnabled },
    { id: 'view.shake', title: 'Screen shake', category: 'View', run: () => (settings.screenShakeEnabled = !settings.screenShakeEnabled), isChecked: () => settings.screenShakeEnabled },
    { id: 'view.theme', title: 'Theme editor...', category: 'View', shortcuts: ['Ctrl+Alt+T'], run: () => ui.openThemeEditor() },
    { id: 'view.resetLayout', title: 'Reset panel sizes and visibility', category: 'View', run: () => settings.resetLayout() },
    {
      id: 'view.fullscreen', title: 'Toggle full screen', category: 'View', shortcuts: ['F11'],
      run: () => void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()),
      isEnabled: () => !isNativeRuntime(),
    },

    { id: 'run.run', title: 'Run', category: 'Run', shortcuts: ['Ctrl+Enter'], run: () => void workspace.run(), isEnabled: () => !workspace.isBusy },
    { id: 'run.check', title: 'Check my work', category: 'Run', shortcuts: ['Ctrl+Shift+Enter'], run: () => void workspace.checkWork(), isEnabled: () => !workspace.isBusy },
    { id: 'run.visualize', title: 'Visualize this file (animate the list it sorts)', category: 'Run', run: () => visualizeActiveFile(), isEnabled: () => !workspace.isBusy },
    { id: 'run.race', title: 'Race the ghost on this mission...', category: 'Run', run: () => ui.startRace(workspace.selectedProjectId), isEnabled: () => !workspace.isFreeCode && progression.hasCompletedProject(workspace.selectedProjectId) },
    { id: 'run.clear', title: 'Clear output', category: 'Run', run: () => workspace.clearOutput() },

    { id: 'go.next', title: 'Next mission', category: 'Go', run: () => void workspace.goToMissionOffset(1) },
    { id: 'go.previous', title: 'Previous mission', category: 'Go', run: () => void workspace.goToMissionOffset(-1) },
    ...PROJECTS.map((project): AppCommand => ({
      id: `go.mission.${project.id}`,
      title: `Go to mission: ${project.title}`,
      category: 'Go',
      run: () => void workspace.selectProject(project.id),
      isChecked: () => workspace.selectedProjectId === project.id,
    })),

    { id: 'help.shortcuts', title: 'Keyboard shortcuts', category: 'Help', run: () => ui.showShortcuts() },
    { id: 'help.about', title: 'About Python Discovery', category: 'Help', run: () => ui.showAbout() },
  ]
  return commands
}

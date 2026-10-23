import { validateNewFileName } from '../curriculum/fileNames'
import { MAIN_FILE_NAME } from '../curriculum/projects'
import { useUiStore } from '../stores/uiStore'
import { useWorkspaceStore } from '../stores/workspaceStore'

/** Prompt-driven file actions shared by the File menu, the command palette and the file tabs. */

export async function requestNewFile(): Promise<void> {
  const ui = useUiStore()
  const workspace = useWorkspaceStore()
  const name = await ui.prompt({
    title: 'New file',
    label: 'File name',
    initial: 'helpers.py',
    confirmLabel: 'Create',
    validate: (value) => validateNewFileName(value, workspace.fileNames),
  })
  if (name === null) return
  const problem = await workspace.createFile(name)
  if (problem) workspace.reportError({ code: 'new-file', message: problem })
}

export async function requestRename(fileName: string): Promise<void> {
  if (fileName === MAIN_FILE_NAME) return
  const ui = useUiStore()
  const workspace = useWorkspaceStore()
  const name = await ui.prompt({
    title: `Rename ${fileName}`,
    label: 'New name',
    initial: fileName,
    confirmLabel: 'Rename',
    validate: (value) => validateNewFileName(value, workspace.fileNames),
  })
  if (name === null) return
  const problem = await workspace.renameFile(fileName, name)
  if (problem) workspace.reportError({ code: 'rename-file', message: problem })
}

export async function requestDelete(fileName: string): Promise<void> {
  if (fileName === MAIN_FILE_NAME) return
  const ui = useUiStore()
  const workspace = useWorkspaceStore()
  const confirmed = await ui.confirm('Delete file?', `${fileName} will be permanently deleted from this mission. This cannot be undone.`, 'Delete')
  if (!confirmed) return
  const problem = await workspace.deleteFile(fileName)
  if (problem) workspace.reportError({ code: 'delete-file', message: problem })
}

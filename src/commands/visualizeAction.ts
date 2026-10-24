import { useUiStore } from '../stores/uiStore'
import { useWorkspaceStore } from '../stores/workspaceStore'

/** Runs the open file under the tracer and shows the animation of the list it changed. */
export async function visualizeActiveFile(): Promise<void> {
  const workspace = useWorkspaceStore()
  const ui = useUiStore()
  const frames = await workspace.visualize()
  if (frames) ui.showVisualization(workspace.activeFileName, frames)
}

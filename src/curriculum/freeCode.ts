import { PROJECTS } from './projects'
import type { Project } from './types'

export const FREE_CODE_ID = 'free-code'

/**
 * The open workspace: no objectives and no checks. It is a normal editor
 * for the student's own programs, kept in its own folder so missions are never touched.
 */
export const FREE_CODE_PROJECT: Project = {
  id: FREE_CODE_ID,
  title: 'Free Code',
  tagline: 'Your own programs, no rules',
  difficulty: 1,
  summary:
    'An open editor: make as many files as you like, import one from another, and run any of them. Nothing here is checked. Use Visualize to watch any list your code sorts.',
  objectives: [],
  starterCode: `# FREE CODE
# Write anything. Run it with Ctrl+Enter.
#
# Sorting something? Press Visualize (Run menu) and watch your own code work.

items = [5, 2, 9, 1, 7, 3]

for end in range(len(items) - 1, 0, -1):
    for i in range(end):
        if items[i] > items[i + 1]:
            items[i], items[i + 1] = items[i + 1], items[i]

print(items)
`,
  testSource: '',
}

/** A mission or the free workspace. */
export function findWorkspace(workspaceId: string): Project | undefined {
  return workspaceId === FREE_CODE_ID ? FREE_CODE_PROJECT : PROJECTS.find((project) => project.id === workspaceId)
}

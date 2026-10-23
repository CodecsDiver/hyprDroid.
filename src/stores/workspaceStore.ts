import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  getSandboxStatus,
  readProjectFile,
  runChecks,
  runPython,
  toBackendError,
  writeProjectFile,
  type BackendError,
  type RunOutcome,
  type SandboxStatus,
} from '../backend/backend'
import { buildCheckSource, parseCheckOutput } from '../curriculum/harness'
import { findProject, MAIN_FILE_NAME, PROJECTS } from '../curriculum/projects'
import type { ObjectiveResult } from '../curriculum/types'
import { emitJuice } from '../juice/juiceBus'
import { useProgressionStore } from './progressionStore'

const AUTOSAVE_DELAY_MS = 1200
const OBJECTIVE_REVEAL_STAGGER_MS = 650

export type OutputView =
  | { kind: 'empty' }
  | { kind: 'run'; outcome: RunOutcome }
  | { kind: 'check'; outcome: RunOutcome; reported: boolean }
  | { kind: 'error'; error: BackendError }

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export const useWorkspaceStore = defineStore('workspace', () => {
  const progression = useProgressionStore()

  const selectedProjectId = ref(PROJECTS[0].id)
  const code = ref('')
  const savedCode = ref('')
  const isProjectLoaded = ref(false)
  const lastSavedAt = ref<number | null>(null)
  const saveError = ref<BackendError | null>(null)
  const isSaving = ref(false)
  const isRunning = ref(false)
  const isChecking = ref(false)
  const output = ref<OutputView>({ kind: 'empty' })
  const objectiveResults = ref<Record<string, ObjectiveResult>>({})
  const sandbox = ref<SandboxStatus | null>(null)
  const consentRequest = ref<{ resolve: (approved: boolean) => void } | null>(null)

  let autosaveTimer: ReturnType<typeof setTimeout> | undefined
  let lastRewardedSaveCode = ''

  const selectedProject = computed(() => findProject(selectedProjectId.value) ?? PROJECTS[0])
  const isDirty = computed(() => code.value !== savedCode.value)
  const isBusy = computed(() => isRunning.value || isChecking.value)
  const metObjectiveCount = computed(
    () => selectedProject.value.objectives.filter((o) => progression.hasMetObjective(selectedProject.value.id, o.id)).length,
  )

  async function initialize(): Promise<void> {
    sandbox.value = await getSandboxStatus().catch(() => null)
    await selectProject(selectedProjectId.value)
  }

  async function selectProject(projectId: string): Promise<void> {
    if (isProjectLoaded.value && isDirty.value) await save({ manual: false })
    clearTimeout(autosaveTimer)
    const project = findProject(projectId) ?? PROJECTS[0]
    selectedProjectId.value = project.id
    isProjectLoaded.value = false
    output.value = { kind: 'empty' }
    objectiveResults.value = {}
    saveError.value = null
    try {
      const existing = await readProjectFile(project.id, MAIN_FILE_NAME)
      code.value = existing ?? project.starterCode
      savedCode.value = existing ?? ''
      if (existing === null) await save({ manual: false })
    } catch (error) {
      saveError.value = toBackendError(error)
      code.value = project.starterCode
    }
    lastRewardedSaveCode = savedCode.value
    isProjectLoaded.value = true
  }

  function updateCode(newCode: string): void {
    if (newCode === code.value) return
    code.value = newCode
    clearTimeout(autosaveTimer)
    autosaveTimer = setTimeout(() => void save({ manual: false }), AUTOSAVE_DELAY_MS)
  }

  /**
   * Writes the file to the project directory. A save only counts as success after the backend confirms;
   * failures stay visible in `saveError` instead of being swallowed.
   */
  async function save(options: { manual: boolean }): Promise<boolean> {
    clearTimeout(autosaveTimer)
    const contentToWrite = code.value
    isSaving.value = true
    try {
      await writeProjectFile(selectedProjectId.value, MAIN_FILE_NAME, contentToWrite)
      savedCode.value = contentToWrite
      lastSavedAt.value = Date.now()
      saveError.value = null
      if (options.manual) {
        emitJuice({ kind: 'saved' })
        if (contentToWrite !== lastRewardedSaveCode) {
          lastRewardedSaveCode = contentToWrite
          progression.record({ type: 'file_saved' })
        }
      }
      return true
    } catch (error) {
      saveError.value = toBackendError(error)
      return false
    } finally {
      isSaving.value = false
    }
  }

  function requestUnsandboxedConsent(): Promise<boolean> {
    return new Promise((resolve) => {
      consentRequest.value = { resolve }
    })
  }

  function answerConsent(approved: boolean): void {
    consentRequest.value?.resolve(approved)
    consentRequest.value = null
  }

  /** Runs `action`; when no sandbox exists, asks once for explicit consent and retries unsandboxed. */
  async function withContainment<T>(action: (allowUnsandboxed: boolean) => Promise<T>): Promise<T | null> {
    try {
      return await action(false)
    } catch (error) {
      const backendError = toBackendError(error)
      if (backendError.code !== 'containment-unavailable') {
        output.value = { kind: 'error', error: backendError }
        return null
      }
      if (!(await requestUnsandboxedConsent())) {
        output.value = { kind: 'error', error: backendError }
        return null
      }
      try {
        return await action(true)
      } catch (retryError) {
        output.value = { kind: 'error', error: toBackendError(retryError) }
        return null
      }
    }
  }

  async function run(): Promise<void> {
    if (isBusy.value) return
    isRunning.value = true
    emitJuice({ kind: 'run-started' })
    try {
      if (!(await save({ manual: false }))) return
      const outcome = await withContainment((allow) => runPython(selectedProjectId.value, MAIN_FILE_NAME, allow))
      if (outcome) {
        output.value = { kind: 'run', outcome }
        progression.record({ type: 'code_run' })
      }
    } finally {
      isRunning.value = false
    }
  }

  async function checkWork(): Promise<void> {
    if (isBusy.value) return
    isChecking.value = true
    emitJuice({ kind: 'run-started' })
    const project = selectedProject.value
    try {
      if (!(await save({ manual: false }))) return
      const nonce = crypto.randomUUID()
      const outcome = await withContainment((allow) =>
        runChecks(project.id, buildCheckSource(project), nonce, allow),
      )
      if (!outcome) return

      const results = parseCheckOutput(outcome.stdout, nonce)
      output.value = { kind: 'check', outcome, reported: results !== null }
      if (!results) {
        objectiveResults.value = {}
        emitJuice({ kind: 'objective-failed' })
        return
      }

      const resultsByObjective: Record<string, ObjectiveResult> = {}
      for (const objective of project.objectives) {
        resultsByObjective[objective.id] = results[`test_${objective.id}`] ?? {
          status: 'error',
          message: 'The test did not report a result.',
        }
      }
      objectiveResults.value = resultsByObjective
      await revealResults(project.id, resultsByObjective)
    } finally {
      isChecking.value = false
    }
  }

  async function revealResults(projectId: string, results: Record<string, ObjectiveResult>): Promise<void> {
    const project = findProject(projectId)
    if (!project) return
    let anyFailed = false
    for (const objective of project.objectives) {
      if (results[objective.id].status !== 'pass') {
        anyFailed = true
        continue
      }
      const isNew = !progression.hasMetObjective(project.id, objective.id)
      if (!isNew) continue
      emitJuice({ kind: 'objective-met', title: objective.title })
      progression.record({ type: 'objective_met', projectId: project.id, objectiveId: objective.id })
      await wait(OBJECTIVE_REVEAL_STAGGER_MS)
    }
    if (anyFailed) emitJuice({ kind: 'objective-failed' })
    const allPassed = !anyFailed
    if (allPassed && !progression.hasCompletedProject(project.id)) {
      emitJuice({ kind: 'project-completed', title: project.title })
      progression.record({ type: 'project_completed', projectId: project.id })
    }
  }

  return {
    selectedProjectId, selectedProject, code, savedCode, isDirty, isProjectLoaded, lastSavedAt, saveError,
    isSaving, isRunning, isChecking, isBusy, output, objectiveResults, sandbox, consentRequest,
    metObjectiveCount, initialize, selectProject, updateCode, save, run, checkWork, answerConsent,
  }
})

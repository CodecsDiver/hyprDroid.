import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  deleteProjectFile,
  getSandboxStatus,
  listProjectFiles,
  readProjectFile,
  renameProjectFile,
  runChecks,
  runPython,
  toBackendError,
  writeProjectFile,
  type BackendError,
  type RunOutcome,
  type SandboxStatus,
} from '../backend/backend'
import { buildCheckSource, parseCheckOutput } from '../curriculum/harness'
import { normalizeNewFileName, sortFileNames, validateNewFileName } from '../curriculum/fileNames'
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
  /** Every .py file in the mission folder, main.py first. `code`/`savedCode` always belong to the active one. */
  const fileNames = ref<string[]>([MAIN_FILE_NAME])
  const activeFileName = ref(MAIN_FILE_NAME)
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
      activeFileName.value = MAIN_FILE_NAME
      const existing = await readProjectFile(project.id, MAIN_FILE_NAME)
      code.value = existing ?? project.starterCode
      savedCode.value = existing ?? ''
      if (existing === null) await save({ manual: false })
      fileNames.value = sortFileNames([MAIN_FILE_NAME, ...(await listProjectFiles(project.id).catch(() => []))])
    } catch (error) {
      saveError.value = toBackendError(error)
      code.value = project.starterCode
      fileNames.value = [MAIN_FILE_NAME]
    }
    lastRewardedSaveCode = savedCode.value
    isProjectLoaded.value = true
  }

  /** Saves the current file first so switching never loses edits. Returns false if that save failed. */
  async function flushActiveFile(): Promise<boolean> {
    return isDirty.value ? save({ manual: false }) : true
  }

  async function openFile(fileName: string): Promise<void> {
    if (fileName === activeFileName.value || !fileNames.value.includes(fileName)) return
    if (!(await flushActiveFile())) return
    try {
      const content = await readProjectFile(selectedProjectId.value, fileName)
      if (content === null) {
        saveError.value = { code: 'file-not-found', message: `${fileName} no longer exists` }
        fileNames.value = fileNames.value.filter((name) => name !== fileName)
        return
      }
      activeFileName.value = fileName
      code.value = content
      savedCode.value = content
      lastRewardedSaveCode = content
      saveError.value = null
    } catch (error) {
      saveError.value = toBackendError(error)
    }
  }

  /** Creates an empty file in the mission and opens it. Returns an error message, or null on success. */
  async function createFile(rawName: string): Promise<string | null> {
    const problem = validateNewFileName(rawName, fileNames.value)
    if (problem) return problem
    if (!(await flushActiveFile())) return 'Could not save the current file first'
    const name = normalizeNewFileName(rawName)
    try {
      await writeProjectFile(selectedProjectId.value, name, '')
    } catch (error) {
      return toBackendError(error).message
    }
    fileNames.value = sortFileNames([...fileNames.value, name])
    activeFileName.value = name
    code.value = ''
    savedCode.value = ''
    lastRewardedSaveCode = ''
    return null
  }

  async function renameFile(fromName: string, rawNewName: string): Promise<string | null> {
    if (fromName === MAIN_FILE_NAME) return `${MAIN_FILE_NAME} is checked by the mission and cannot be renamed`
    const problem = validateNewFileName(rawNewName, fileNames.value)
    if (problem) return problem
    if (fromName === activeFileName.value && !(await flushActiveFile())) return 'Could not save the file first'
    const newName = normalizeNewFileName(rawNewName)
    try {
      await renameProjectFile(selectedProjectId.value, fromName, newName)
    } catch (error) {
      return toBackendError(error).message
    }
    fileNames.value = sortFileNames(fileNames.value.map((name) => (name === fromName ? newName : name)))
    if (activeFileName.value === fromName) activeFileName.value = newName
    return null
  }

  async function deleteFile(fileName: string): Promise<string | null> {
    if (fileName === MAIN_FILE_NAME) return `${MAIN_FILE_NAME} is checked by the mission and cannot be deleted`
    try {
      await deleteProjectFile(selectedProjectId.value, fileName)
    } catch (error) {
      return toBackendError(error).message
    }
    const wasActive = activeFileName.value === fileName
    fileNames.value = fileNames.value.filter((name) => name !== fileName)
    if (wasActive) {
      savedCode.value = code.value
      await openFile(MAIN_FILE_NAME).catch(() => undefined)
      if (activeFileName.value === fileName) activeFileName.value = MAIN_FILE_NAME
    }
    return null
  }

  async function resetToStarter(): Promise<void> {
    await openFile(MAIN_FILE_NAME)
    updateCode(selectedProject.value.starterCode)
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
    const fileToWrite = activeFileName.value
    isSaving.value = true
    try {
      await writeProjectFile(selectedProjectId.value, fileToWrite, contentToWrite)
      // Only mark clean if the student has not switched files while the write was in flight.
      if (fileToWrite === activeFileName.value) savedCode.value = contentToWrite
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

  function reportError(error: BackendError): void {
    output.value = { kind: 'error', error }
  }

  function clearOutput(): void {
    output.value = { kind: 'empty' }
  }

  async function goToMissionOffset(offset: number): Promise<void> {
    const index = PROJECTS.findIndex((project) => project.id === selectedProjectId.value)
    const target = PROJECTS[(index + offset + PROJECTS.length) % PROJECTS.length]
    await selectProject(target.id)
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
      const outcome = await withContainment((allow) => runPython(selectedProjectId.value, activeFileName.value, allow))
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
      progression.record({ type: 'objective_met', projectId: project.id, objectiveId: objective.id, difficulty: project.difficulty })
      await wait(OBJECTIVE_REVEAL_STAGGER_MS)
    }
    if (anyFailed) emitJuice({ kind: 'objective-failed' })
    const allPassed = !anyFailed
    if (allPassed && !progression.hasCompletedProject(project.id)) {
      emitJuice({ kind: 'project-completed', title: project.title })
      progression.record({ type: 'project_completed', projectId: project.id, difficulty: project.difficulty })
    }
  }

  return {
    selectedProjectId, selectedProject, code, savedCode, fileNames, activeFileName, isDirty, isProjectLoaded, lastSavedAt, saveError,
    isSaving, isRunning, isChecking, isBusy, output, objectiveResults, sandbox, consentRequest,
    metObjectiveCount, initialize, selectProject, openFile, createFile, renameFile, deleteFile, resetToStarter, clearOutput, reportError, goToMissionOffset, updateCode, save, run, checkWork, answerConsent,
  }
})

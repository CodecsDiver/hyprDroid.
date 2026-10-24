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
import { FREE_CODE_ID, findWorkspace } from '../curriculum/freeCode'
import { normalizeNewFileName, RESERVED_FILE_NAMES, sortFileNames, validateNewFileName } from '../curriculum/fileNames'
import { findProject, MAIN_FILE_NAME, PROJECTS } from '../curriculum/projects'
import type { ObjectiveResult } from '../curriculum/types'
import type { SortFrame } from '../visualizers/algorithms/sorting'
import { emitJuice } from '../juice/juiceBus'
import { buildTraceRunnerSource, parseTraceOutput, TRACE_RUNNER_FILE_NAME } from '../lab/traceRunner'
import { formatMs, RunRecorder } from '../ghost/ghostRecord'
import { MAX_STRIKES } from '../practice/strikes'
import { usePracticeStore } from './practiceStore'
import { useProgressionStore } from './progressionStore'
import { useUiStore } from './uiStore'

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
  const practice = usePracticeStore()
  const ui = useUiStore()

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
  /** Times a mission typed from the starter code to its first pass, so the run can become a ghost. */
  let recorder: RunRecorder | null = null
  const isRecording = ref(false)
  let lastRewardedSaveCode = ''

  const selectedProject = computed(() => findWorkspace(selectedProjectId.value) ?? PROJECTS[0])
  const isFreeCode = computed(() => selectedProjectId.value === FREE_CODE_ID)
  /** main.py is every workspace's entry file (the mission checks import it), so it can be edited but never renamed or deleted. */
  const isProtectedFile = (fileName: string) => fileName === MAIN_FILE_NAME
  const listVisibleFiles = async (projectId: string) =>
    (await listProjectFiles(projectId).catch(() => [] as string[])).filter((name) => !RESERVED_FILE_NAMES.includes(name))
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
    const project = findWorkspace(projectId) ?? PROJECTS[0]
    selectedProjectId.value = project.id
    isProjectLoaded.value = false
    output.value = { kind: 'empty' }
    objectiveResults.value = {}
    saveError.value = null
    try {
      const existingFiles = await listVisibleFiles(project.id)
      // A mission always has main.py. The free workspace opens main.py if it still exists, otherwise its first file.
      const openName = project.id === FREE_CODE_ID && !existingFiles.includes(MAIN_FILE_NAME) && existingFiles.length > 0
        ? sortFileNames(existingFiles)[0]
        : MAIN_FILE_NAME
      activeFileName.value = openName
      const existing = await readProjectFile(project.id, openName)
      code.value = existing ?? project.starterCode
      savedCode.value = existing ?? ''
      if (existing === null) await save({ manual: false })
      fileNames.value = sortFileNames([openName, ...existingFiles])
    } catch (error) {
      saveError.value = toBackendError(error)
      code.value = project.starterCode
      fileNames.value = [MAIN_FILE_NAME]
    }
    lastRewardedSaveCode = savedCode.value
    startRecording()
    isProjectLoaded.value = true
  }

  /** Recording only makes sense from untouched starter code; a half-finished file has no honest start time. */
  function startRecording(): void {
    const canRecord = !isFreeCode.value && activeFileName.value === MAIN_FILE_NAME && code.value === selectedProject.value.starterCode
    recorder = canRecord ? new RunRecorder(code.value) : null
    isRecording.value = recorder !== null
  }

  /** Active milliseconds on the current recorded run, 0 when there is none. */
  const runElapsedMs = () => recorder?.elapsed(Date.now()) ?? 0


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
    if (isProtectedFile(fromName)) return `${MAIN_FILE_NAME} is the entry file of this workspace and cannot be renamed`
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
    if (isProtectedFile(fileName)) return `${MAIN_FILE_NAME} is the entry file of this workspace and cannot be deleted`
    if (fileNames.value.length <= 1) return 'A workspace needs at least one file. Create another one first.'
    try {
      await deleteProjectFile(selectedProjectId.value, fileName)
    } catch (error) {
      return toBackendError(error).message
    }
    const wasActive = activeFileName.value === fileName
    fileNames.value = fileNames.value.filter((name) => name !== fileName)
    if (wasActive) {
      savedCode.value = code.value
      const fallback = fileNames.value.includes(MAIN_FILE_NAME) ? MAIN_FILE_NAME : fileNames.value[0]
      await openFile(fallback).catch(() => undefined)
      if (activeFileName.value === fileName) activeFileName.value = fallback
    }
    return null
  }

  async function resetToStarter(): Promise<void> {
    if (!fileNames.value.includes(MAIN_FILE_NAME)) return
    await openFile(MAIN_FILE_NAME)
    updateCode(selectedProject.value.starterCode)
    startRecording()
  }

  function updateCode(newCode: string): void {
    if (newCode === code.value) return
    if (activeFileName.value === MAIN_FILE_NAME) recorder?.change(newCode, Date.now())
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

  /**
   * Runs the active file under the tracer and returns the steps taken by the first list of numbers it changed.
   * Returns null (after reporting why) when the program never changed such a list.
   */
  async function visualize(): Promise<SortFrame[] | null> {
    if (isBusy.value) return null
    isRunning.value = true
    try {
      if (!(await save({ manual: false }))) return null
      const projectId = selectedProjectId.value
      await writeProjectFile(projectId, TRACE_RUNNER_FILE_NAME, buildTraceRunnerSource('auto', activeFileName.value))
      const outcome = await withContainment((allow) => runPython(projectId, TRACE_RUNNER_FILE_NAME, allow))
      if (!outcome) return null
      const frames = parseTraceOutput(outcome.stdout)
      if (!frames) {
        output.value = { kind: 'run', outcome }
        reportError({
          code: 'visualize',
          message: outcome.exitCode === 0
            ? `${activeFileName.value} ran, but no list of numbers (up to 40) changed while it ran, so there is nothing to animate. Try a sort that rearranges a list in place.`
            : `${activeFileName.value} stopped with an error before a list could be animated. Fix it with Run first.`,
        })
      }
      return frames
    } catch (error) {
      reportError(toBackendError(error))
      return null
    } finally {
      isRunning.value = false
    }
  }

  async function checkWork(): Promise<void> {
    if (isBusy.value) return
    if (isFreeCode.value) {
      output.value = { kind: 'error', error: { code: 'free-code', message: 'Free Code has no objectives to check. Pick a mission on the left to be checked, or just press Run.' } }
      return
    }
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
        void takeStrike(project.id)
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
      if (project.objectives.some((objective) => resultsByObjective[objective.id].status !== 'pass')) void takeStrike(project.id)
    } finally {
      isChecking.value = false
    }
  }

  /**
   * Checks a piece of code against a mission without touching the student's own files: the code is written to a
   * separate practice folder. Used by Ghostcode races.
   */
  async function checkPracticeCopy(missionId: string, practiceCode: string): Promise<{ results: Record<string, ObjectiveResult> | null; detail: string }> {
    const mission = findProject(missionId)
    if (!mission) return { results: null, detail: 'Unknown mission.' }
    const practiceFolder = `ghost-${mission.id}`
    try {
      await writeProjectFile(practiceFolder, MAIN_FILE_NAME, practiceCode)
    } catch (error) {
      return { results: null, detail: toBackendError(error).message }
    }
    const nonce = crypto.randomUUID()
    const outcome = await withContainment((allow) => runChecks(practiceFolder, buildCheckSource(mission), nonce, allow))
    if (!outcome) return { results: null, detail: output.value.kind === 'error' ? output.value.error.message : 'The checks could not run.' }
    const parsed = parseCheckOutput(outcome.stdout, nonce)
    if (!parsed) return { results: null, detail: (outcome.stderr || outcome.stdout || 'The checks could not report. Look for a syntax error.').slice(0, 400) }
    const results: Record<string, ObjectiveResult> = {}
    for (const objective of mission.objectives) {
      results[objective.id] = parsed[`test_${objective.id}`] ?? { status: 'error', message: 'The test did not report a result.' }
    }
    return { results, detail: '' }
  }

  /** A failed Check my work costs one strike. The third one opens the full commented solution. */
  async function takeStrike(missionId: string): Promise<void> {
    const outcome = practice.registerFailedCheck(missionId)
    if (!outcome.justUnlocked) return
    const wantsSolution = await ui.confirm(
      `Strike ${MAX_STRIKES} of ${MAX_STRIKES}`,
      'Three checks have not passed. Here is the full solution, commented to explain what each part does, why, and how. Read it, then type it into your own file.',
      'Open the solution',
    )
    if (wantsSolution) await practice.openSolution(missionId)
  }

  /** The first all-green check after typing from the starter code is a timed run; it becomes the ghost if it is the fastest. */
  function finishRecordedRun(missionId: string, title: string): void {
    const record = recorder?.finish(`mission:${missionId}`, Date.now())
    recorder = null
    isRecording.value = false
    if (!record) return
    const verdict = practice.submitRun(record)
    if (verdict === 'slower') return
    emitJuice({
      kind: 'banner',
      tone: 'amber',
      headline: verdict === 'first' ? 'GHOST CREATED' : 'NEW GHOST: FASTER RUN',
      detail: `${title} in ${formatMs(record.ms)}. Replay it from the Missions panel to race yourself.`,
    })
    emitJuice({ kind: 'celebrate', scale: 1 })
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
    if (allPassed) {
      practice.registerMissionCleared(project.id)
      finishRecordedRun(project.id, project.title)
    }
  }

  return {
    isRecording, runElapsedMs, checkPracticeCopy, selectedProjectId, selectedProject, isFreeCode, isProtectedFile, visualize, code, savedCode, fileNames, activeFileName, isDirty, isProjectLoaded, lastSavedAt, saveError,
    isSaving, isRunning, isChecking, isBusy, output, objectiveResults, sandbox, consentRequest,
    metObjectiveCount, initialize, selectProject, openFile, createFile, renameFile, deleteFile, resetToStarter, clearOutput, reportError, goToMissionOffset, updateCode, save, run, checkWork, answerConsent,
  }
})

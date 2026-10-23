export interface Objective {
  /** Matches the `test_<id>` method in the project's test source. */
  id: string
  title: string
  hint: string
}

export interface Project {
  id: string
  title: string
  tagline: string
  difficulty: 1 | 2 | 3 | 4 | 5
  summary: string
  starterCode: string
  objectives: Objective[]
  /** unittest cases; they subclass `StudentTestCase` and reach the student's code via `student`. */
  testSource: string
}

export type ObjectiveStatus = 'pass' | 'fail' | 'error'

export interface ObjectiveResult {
  status: ObjectiveStatus
  message: string
}

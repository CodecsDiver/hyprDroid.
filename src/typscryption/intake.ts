import { SKILL_LIBRARIES } from './levels'

export type Experience = 'new' | 'some' | 'lots'
export type Confidence = 'low' | 'mid' | 'high'
export type TypingSpeed = 'slow' | 'steady' | 'fast'

export interface IntakeAnswers {
  experience: Experience
  confidence: Confidence
  typing: TypingSpeed
}

export interface IntakeQuestion<T extends string> {
  id: 'experience' | 'confidence' | 'typing'
  prompt: string
  options: ReadonlyArray<{ value: T; label: string; detail: string }>
}

/** Question 1 picks the library. */
export const EXPERIENCE_QUESTION: IntakeQuestion<Experience> = {
  id: 'experience',
  prompt: 'How long have you been coding?',
  options: [
    { value: 'new', label: 'Under 6 months', detail: 'Brand new, or just getting started' },
    { value: 'some', label: '6 months to 2 years', detail: 'I have written real programs' },
    { value: 'lots', label: 'More than 2 years', detail: 'Code is part of my regular life' },
  ],
}

/** Question 2 picks the level inside that library, so its wording follows the library you landed in. */
export function confidenceQuestion(experience: Experience): IntakeQuestion<Confidence> {
  const wording: Record<Experience, [string, string, string]> = {
    new: ['I am still learning what code looks like', 'I can read short programs and change them', 'I can write small programs on my own'],
    some: ['I need examples before I write loops and functions', 'I write loops and functions on my own', 'I build small projects without help'],
    lots: ['I use classes and libraries but look things up often', 'I write clean code most of the time', 'I could explain and refactor other people\'s code'],
  }
  const [low, mid, high] = wording[experience]
  return {
    id: 'confidence',
    prompt: 'Which sounds most like you?',
    options: [
      { value: 'low', label: low, detail: 'Starts you at the easiest level of your library' },
      { value: 'mid', label: mid, detail: 'Starts you in the middle' },
      { value: 'high', label: high, detail: 'Starts you at the top of your library' },
    ],
  }
}

/** Question 3 tunes the bot's pace to how fast you can actually physically type. */
export const TYPING_QUESTION: IntakeQuestion<TypingSpeed> = {
  id: 'typing',
  prompt: 'How fast do you type?',
  options: [
    { value: 'slow', label: 'Hunt and peck', detail: 'Under about 25 words a minute: the bot gives you more time' },
    { value: 'steady', label: 'Comfortable', detail: 'About 25 to 50 words a minute' },
    { value: 'fast', label: 'Touch typist', detail: 'Over about 50 words a minute: the bot pushes harder' },
  ],
}

export const TYPING_FACTOR: Record<TypingSpeed, number> = { slow: 1.25, steady: 1, fast: 0.8 }

const LIBRARY_INDEX: Record<Experience, number> = { new: 0, some: 1, lots: 2 }
const LEVEL_OFFSET: Record<Confidence, number> = { low: 0, mid: 1, high: 2 }

export interface Placement {
  libraryIndex: number
  libraryId: (typeof SKILL_LIBRARIES)[number]['id']
  level: number
  typingFactor: number
}

/** Turns the three answers into the library, starting level and bot pace. */
export function placeLearner(answers: IntakeAnswers): Placement {
  const libraryIndex = LIBRARY_INDEX[answers.experience]
  return {
    libraryIndex,
    libraryId: SKILL_LIBRARIES[libraryIndex].id,
    level: libraryIndex * 3 + LEVEL_OFFSET[answers.confidence] + 1,
    typingFactor: TYPING_FACTOR[answers.typing],
  }
}

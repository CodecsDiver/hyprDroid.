export type DateCategory = 'anything' | 'at_home' | 'outdoors' | 'food' | 'creative' | 'adventure' | 'cozy'
export const DATE_CATEGORIES: readonly { id: DateCategory; label: string }[] = [
  { id: 'anything', label: 'Anything' },
  { id: 'at_home', label: 'At home' },
  { id: 'outdoors', label: 'Outdoors' },
  { id: 'food', label: 'Food' },
  { id: 'creative', label: 'Creative' },
  { id: 'adventure', label: 'Adventure' },
  { id: 'cozy', label: 'Cozy' },
]

export interface DateIdea {
  id: string
  title: string
  notes: string | null
  category: DateCategory
  isFavorite: boolean
  completedAt: string | null
  completedNote: string | null
  rating: number | null
  createdBy: string
  createdAt: string
}

export interface DrawOptions {
  rng?: () => number
  category?: DateCategory
  /** Avoid drawing the same idea twice in a row when there is a choice. */
  excludeId?: string | null
  favoriteWeight?: number
}

/** Random idea from the jar: only open ideas, favourites weighted up, optional category filter. */
export function drawIdea(ideas: readonly DateIdea[], options: DrawOptions = {}): DateIdea | null {
  const rng = options.rng ?? Math.random
  const weight = options.favoriteWeight ?? 2
  let pool = ideas.filter((idea) => idea.completedAt === null)
  if (options.category && options.category !== 'anything') {
    pool = pool.filter((idea) => idea.category === options.category || idea.category === 'anything')
  }
  if (pool.length > 1 && options.excludeId) pool = pool.filter((idea) => idea.id !== options.excludeId)
  if (pool.length === 0) return null

  const weights = pool.map((idea) => (idea.isFavorite ? weight : 1))
  const total = weights.reduce((sum, w) => sum + w, 0)
  let cursor = rng() * total
  for (let index = 0; index < pool.length; index++) {
    cursor -= weights[index]!
    if (cursor < 0) return pool[index]!
  }
  return pool[pool.length - 1]!
}

/** Generic starter ideas people can add to their jar with one tap. */
export const STARTER_IDEAS: readonly { title: string; category: DateCategory }[] = [
  { title: 'Cook a new recipe together', category: 'food' },
  { title: 'Build a blanket fort and watch a movie', category: 'cozy' },
  { title: 'Take a sunset walk with no destination', category: 'outdoors' },
  { title: 'Make up a playlist for each other', category: 'creative' },
  { title: 'Stargaze and name our own constellation', category: 'outdoors' },
  { title: 'Have a candlelit dinner at home', category: 'at_home' },
  { title: 'Try a game neither of us has played', category: 'at_home' },
  { title: 'Plan a pretend trip and map every stop', category: 'adventure' },
  { title: 'Draw each other, badly, on purpose', category: 'creative' },
  { title: 'Pick a stranger-than-usual snack and rate it', category: 'food' },
]

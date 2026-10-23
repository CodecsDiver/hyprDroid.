/**
 * Love Universe content helpers.
 *
 * The ORIGINAL notes (35 love notes, 13 miss-you notes, sticker art) are private
 * and are imported into the database by scripts/seed-private-content.mjs — they
 * are never part of this repository. The lists below are neutral starter copy
 * so the experience works before anything is imported.
 */

export const STARTER_LOVE_NOTES: readonly string[] = [
  'You make ordinary days feel special.',
  'I would choose you in every timeline.',
  'You are my soft place to land.',
  'Your smile fixes my whole day in three seconds.',
  'I am so lucky I get to love you.',
  'You are the person I want to tell every tiny detail to.',
]

export const STARTER_MISS_NOTES: readonly string[] = [
  'Sending you a tiny pocket-sized hug.',
  'I miss you extra right now.',
  'Come here. Actually. Immediately.',
  'You have been hugged. This is legally binding.',
]

/** Generic floating words; the partner's name is appended at runtime. */
export const FLOATING_WORDS: readonly string[] = [
  'love', 'always', 'mine', 'cute', 'forever', 'hug', 'kiss', 'sweetheart', 'moonbeam', 'adorable',
]

export interface PickedNote {
  text: string
  index: number
}

/** Random pick that never repeats the previous note when there is a choice. */
export function pickNote(pool: readonly string[], rng: () => number, lastIndex: number | null): PickedNote | null {
  if (pool.length === 0) return null
  if (pool.length === 1) return { text: pool[0]!, index: 0 }
  let index = Math.floor(rng() * pool.length)
  if (index === lastIndex) index = (index + 1 + Math.floor(rng() * (pool.length - 1))) % pool.length
  return { text: pool[index]!, index }
}

export interface SpriteGeometry {
  cols: number
  rows: number
  index: number
}

/** CSS for one cell of a sprite sheet (same technique as the original's background-position stickers). */
export function spriteStyle(sprite: SpriteGeometry, url: string): Record<string, string> {
  const column = sprite.index % sprite.cols
  const row = Math.floor(sprite.index / sprite.cols)
  const x = sprite.cols === 1 ? 0 : (column / (sprite.cols - 1)) * 100
  const y = sprite.rows === 1 ? 0 : (row / (sprite.rows - 1)) * 100
  return {
    backgroundImage: `url("${url.replace(/"/g, "%22")}")`,
    backgroundSize: `${sprite.cols * 100}% ${sprite.rows * 100}%`,
    backgroundPosition: `${x}% ${y}%`,
    backgroundRepeat: 'no-repeat',
  }
}

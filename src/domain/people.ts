/** Daniel and Vee are the two intended people; a persona only themes copy and the Spell Table. */
export type Persona = 'daniel' | 'vee'

export function personaFor(displayName: string | null | undefined): Persona | null {
  const name = (displayName ?? '').trim().toLowerCase()
  if (name.startsWith('daniel')) return 'daniel'
  if (name.startsWith('vee')) return 'vee'
  return null
}

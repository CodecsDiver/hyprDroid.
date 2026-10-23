import type { PlantSpecies } from '@/domain/moods'

/** Vector shapes for a bloom, drawn around (0,0). Simple on purpose: placeholder-grade garden art. */
export type Shape =
  | { kind: 'circle'; cx: number; cy: number; r: number; fill: string; opacity?: number }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; fill: string; rotate?: number; opacity?: number }

function petals(count: number, radius: number, rx: number, ry: number, fill: string): Shape[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2
    return { kind: 'ellipse', cx: Math.cos(angle) * radius, cy: Math.sin(angle) * radius, rx, ry, fill, rotate: (angle * 180) / Math.PI }
  })
}

export function bloomShapes(species: PlantSpecies, color: string, stage: number): Shape[] {
  const k = 0.6 + stage * 0.22 // bloom size by growth stage
  const scale = (shapes: Shape[]): Shape[] =>
    shapes.map((s) => (s.kind === 'circle' ? { ...s, cx: s.cx * k, cy: s.cy * k, r: s.r * k } : { ...s, cx: s.cx * k, cy: s.cy * k, rx: s.rx * k, ry: s.ry * k }))
  switch (species) {
    case 'sunflower': return scale([...petals(12, 9, 6, 2.6, color), { kind: 'circle', cx: 0, cy: 0, r: 6, fill: '#5a3418' }])
    case 'daisy': return scale([...petals(10, 7, 5, 2, '#ffffff'), { kind: 'circle', cx: 0, cy: 0, r: 3.6, fill: color }])
    case 'chamomile': return scale([...petals(8, 6, 4, 1.8, '#fffdf5'), { kind: 'circle', cx: 0, cy: 0, r: 3, fill: '#ffcf4d' }])
    case 'marigold': return scale([...petals(10, 6, 5, 3, color), ...petals(6, 3, 3, 2, '#ffd27a')])
    case 'peony': return scale([...petals(9, 7, 6, 4, color), ...petals(6, 3.5, 4, 3, '#ffc2dd'), { kind: 'circle', cx: 0, cy: 0, r: 2, fill: '#ffe9a8' }])
    case 'lavender': return scale([0, 1, 2, 3].map((i): Shape => ({ kind: 'ellipse', cx: 0, cy: -i * 4 + 3, rx: 2.6, ry: 3.2, fill: color })))
    case 'bluebell': return scale([{ kind: 'ellipse', cx: -3, cy: 3, rx: 3.6, ry: 5, fill: color }, { kind: 'ellipse', cx: 4, cy: 7, rx: 3.2, ry: 4.4, fill: color, opacity: 0.9 }])
    case 'snowdrop': return scale([{ kind: 'ellipse', cx: 0, cy: 5, rx: 3.6, ry: 6, fill: color }, { kind: 'circle', cx: 0, cy: 10, r: 1.4, fill: '#9be8a8' }])
    case 'clover': return scale([{ kind: 'circle', cx: -4, cy: 0, r: 4, fill: color }, { kind: 'circle', cx: 4, cy: 0, r: 4, fill: color }, { kind: 'circle', cx: 0, cy: -4, r: 4, fill: color }])
    case 'moonflower': return scale([{ kind: 'circle', cx: 0, cy: 0, r: 11, fill: color, opacity: 0.25 }, ...petals(6, 5, 5, 3, '#f2eeff'), { kind: 'circle', cx: 0, cy: 0, r: 2.4, fill: color }])
  }
}

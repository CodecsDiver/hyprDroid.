/** Small, dependency-free colour helpers for the theme system. All inputs/outputs are #rrggbb strings unless noted. */

const HEX6 = /^#[0-9a-f]{6}$/i

export function normalizeHex(input: string): string | null {
  let value = input.trim().toLowerCase()
  if (/^[0-9a-f]{3,8}$/.test(value)) value = `#${value}`
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(value)
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`
  const withAlpha = /^#([0-9a-f]{6})([0-9a-f]{2})$/.exec(value)
  if (withAlpha) return `#${withAlpha[1]}`
  return HEX6.test(value) ? value : null
}

export function isHexColor(value: string): boolean {
  return HEX6.test(value)
}

export function hexToRgb(hex: string): [number, number, number] {
  const value = normalizeHex(hex) ?? '#000000'
  return [parseInt(value.slice(1, 3), 16), parseInt(value.slice(3, 5), 16), parseInt(value.slice(5, 7), 16)]
}

export function rgbToHex(red: number, green: number, blue: number): string {
  const part = (channel: number) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0')
  return `#${part(red)}${part(green)}${part(blue)}`
}

/** "25 230 255", the form CSS needs for `rgb(var(--x-rgb) / 0.3)`. */
export function hexToRgbTriplet(hex: string): string {
  return hexToRgb(hex).join(' ')
}

export function hexToHue(hex: string): number {
  const [red, green, blue] = hexToRgb(hex).map((channel) => channel / 255)
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min
  if (delta === 0) return 0
  let hue: number
  if (max === red) hue = ((green - blue) / delta) % 6
  else if (max === green) hue = (blue - red) / delta + 2
  else hue = (red - green) / delta + 4
  return Math.round((hue * 60 + 360) % 360)
}

export function hexToSaturation(hex: string): number {
  const [red, green, blue] = hexToRgb(hex).map((channel) => channel / 255)
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  return max === 0 ? 0 : (max - min) / max
}

/** Perceived brightness, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const [red, green, blue] = hexToRgb(hex)
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255
}

export function mixHex(from: string, to: string, amount: number): string {
  const [r1, g1, b1] = hexToRgb(from)
  const [r2, g2, b2] = hexToRgb(to)
  return rgbToHex(r1 + (r2 - r1) * amount, g1 + (g2 - g1) * amount, b1 + (b2 - b1) * amount)
}

/** Circular distance between two hues in degrees (0..180). */
export function hueDistance(a: number, b: number): number {
  const difference = Math.abs(a - b) % 360
  return difference > 180 ? 360 - difference : difference
}

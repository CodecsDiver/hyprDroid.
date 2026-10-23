import { describe, expect, it } from 'vitest'
import { clampSize, DEFAULT_LAYOUT, resizedSize, sanitizeLayout } from './resize'

describe('resize helpers', () => {
  it('clamps to the range and lets the minimum win when the range is impossible', () => {
    expect(clampSize(100, 200, 500)).toBe(200)
    expect(clampSize(900, 200, 500)).toBe(500)
    expect(clampSize(320.4, 200, 500)).toBe(320)
    expect(clampSize(400, 200, 150)).toBe(200)
  })

  it('grows a panel when its trailing edge is dragged outward and when a leading edge is dragged inward', () => {
    expect(resizedSize(300, 40, false, 200, 560)).toBe(340)
    expect(resizedSize(290, -40, true, 200, 560)).toBe(330)
    expect(resizedSize(300, -500, false, 200, 560)).toBe(200)
  })

  it('ignores corrupt saved layout values', () => {
    const layout = sanitizeLayout({ leftWidth: 'wide', rightWidth: NaN, outputHeight: 9e9, labSidebarWidth: 333.7, labTypingHeight: 'x' })
    expect(layout.leftWidth).toBe(DEFAULT_LAYOUT.leftWidth)
    expect(layout.rightWidth).toBe(DEFAULT_LAYOUT.rightWidth)
    expect(layout.outputHeight).toBe(DEFAULT_LAYOUT.outputHeight)
    expect(layout.labSidebarWidth).toBe(334)
  })
})

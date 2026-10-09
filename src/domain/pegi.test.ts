import { describe, expect, it } from 'vitest'
import { pegiLayout } from './pegi'

describe('PEGI reference proportions', () => {
  it.each([[100, 125], [75, 100], [140, 80]])('keeps the color square and footer inside a %s × %s frame', (width, height) => {
    const badge = pegiLayout(width, height)
    expect(badge.left).toBeGreaterThanOrEqual(0)
    expect(badge.top).toBeGreaterThanOrEqual(0)
    expect(badge.left + badge.width).toBeLessThanOrEqual(width)
    expect(badge.top + badge.height).toBeLessThanOrEqual(height)
    expect(badge.width - badge.square - badge.inset).toBeCloseTo(badge.inset)
    expect(badge.border).toBeLessThan(badge.inset / 4)
    const footerBottom = badge.inset + badge.square + badge.width * 0.015 + badge.footerSize * 1.2
    expect(footerBottom).toBeLessThan(badge.height - badge.border)
  })
})

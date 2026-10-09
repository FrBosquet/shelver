import type { Format } from './types'

// Unfolded paper insert trim sizes, excluding bleed. Canvas resolution: 300 DPI.
const pixelsPerMm = 300 / 25.4
function caseFormat(id: string, name: string, width: number, height: number, spine: number): Format {
  const face = (width - spine) / 2
  return {
    id, name, unit: 'px', width: width * pixelsPerMm, height: height * pixelsPerMm,
    printSize: { width, height }, bleed: 0, safeMargin: 3 * pixelsPerMm,
    panels: [
      { id: 'back', x: 0, width: face * pixelsPerMm },
      { id: 'spine', x: face * pixelsPerMm, width: spine * pixelsPerMm },
      { id: 'front', x: (face + spine) * pixelsPerMm, width: face * pixelsPerMm },
    ],
  }
}
export const caseFormats = [
  caseFormat('dvd-standard', 'DVD · 273 × 183 mm · 14 mm spine', 273, 183, 14),
  caseFormat('switch-standard', 'Switch · 208 × 161 mm · 10 mm spine', 208, 161, 10),
  caseFormat('ps4-ps5-standard', 'PS4 / PS5 · 273 × 161 mm · 14 mm spine', 273, 161, 14),
  caseFormat('ps3-standard', 'PS3 · 273 × 149 mm · 14 mm spine', 273, 149, 14),
  caseFormat('xbox-one-series-standard', 'Xbox One / Series X · 267 × 149 mm · 11 mm spine', 267, 149, 11),
]

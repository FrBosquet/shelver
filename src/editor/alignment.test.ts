import { describe, expect, it } from 'vitest'
import { alignOffsets, distributeOffsets, type Bounds } from './alignment'

const boxes: Bounds[] = [
  { left: 10, top: 20, width: 30, height: 10 },
  { left: 50, top: 0, width: 10, height: 40 },
  { left: 100, top: 60, width: 20, height: 20 },
]
const apply = (offsets: { dx: number; dy: number }[]) => boxes.map((box, index) => ({ ...box, left: box.left + offsets[index].dx, top: box.top + offsets[index].dy }))

describe('alignOffsets', () => {
  it('aligns edges to the combined bounds', () => {
    expect(apply(alignOffsets(boxes, 'left')).map((box) => box.left)).toEqual([10, 10, 10])
    expect(apply(alignOffsets(boxes, 'right')).map((box) => box.left + box.width)).toEqual([120, 120, 120])
    expect(apply(alignOffsets(boxes, 'top')).map((box) => box.top)).toEqual([0, 0, 0])
    expect(apply(alignOffsets(boxes, 'bottom')).map((box) => box.top + box.height)).toEqual([80, 80, 80])
  })

  it('centers on each axis without moving the other', () => {
    const centeredX = apply(alignOffsets(boxes, 'centerX'))
    expect(centeredX.map((box) => box.left + box.width / 2)).toEqual([65, 65, 65])
    expect(centeredX.map((box) => box.top)).toEqual(boxes.map((box) => box.top))
    expect(apply(alignOffsets(boxes, 'centerY')).map((box) => box.top + box.height / 2)).toEqual([40, 40, 40])
  })
})

describe('distributeOffsets', () => {
  it('leaves equal gaps and keeps the outer boxes in place', () => {
    const result = apply(distributeOffsets(boxes, 'horizontal'))
    expect(result.map((box) => box.left)).toEqual([10, 65, 100])
    expect(result.map((box) => box.top)).toEqual(boxes.map((box) => box.top))
  })

  it('follows the current order on the vertical axis', () => {
    const result = apply(distributeOffsets(boxes, 'vertical'))
    // Sorted by center: box 1 (20), box 0 (25), box 2 (70). Gap = (80 - 70) / 2.
    expect(result.map((box) => box.top)).toEqual([45, 0, 60])
  })

  it('needs at least three boxes', () => {
    expect(distributeOffsets(boxes.slice(0, 2), 'horizontal')).toEqual([{ dx: 0, dy: 0 }, { dx: 0, dy: 0 }])
  })
})

export type Bounds = { left: number; top: number; width: number; height: number }
export type AlignMode = 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom'
export type DistributeAxis = 'horizontal' | 'vertical'
export type Offset = { dx: number; dy: number }

/** Offsets that align every box to the matching edge or center of their combined bounds. */
export function alignOffsets(boxes: Bounds[], mode: AlignMode): Offset[] {
  if (boxes.length < 2) return boxes.map(() => ({ dx: 0, dy: 0 }))
  const left = Math.min(...boxes.map((box) => box.left))
  const top = Math.min(...boxes.map((box) => box.top))
  const right = Math.max(...boxes.map((box) => box.left + box.width))
  const bottom = Math.max(...boxes.map((box) => box.top + box.height))
  return boxes.map((box) => {
    switch (mode) {
      case 'left': return { dx: left - box.left, dy: 0 }
      case 'right': return { dx: right - (box.left + box.width), dy: 0 }
      case 'centerX': return { dx: (left + right) / 2 - (box.left + box.width / 2), dy: 0 }
      case 'top': return { dx: 0, dy: top - box.top }
      case 'bottom': return { dx: 0, dy: bottom - (box.top + box.height) }
      case 'centerY': return { dx: 0, dy: (top + bottom) / 2 - (box.top + box.height / 2) }
    }
  })
}

/**
 * Offsets that leave the same gap between consecutive boxes along an axis.
 * The outermost boxes stay in place; the others are spaced between them in
 * their current order.
 */
export function distributeOffsets(boxes: Bounds[], axis: DistributeAxis): Offset[] {
  const offsets = boxes.map(() => ({ dx: 0, dy: 0 }))
  if (boxes.length < 3) return offsets
  const start = (box: Bounds) => axis === 'horizontal' ? box.left : box.top
  const size = (box: Bounds) => axis === 'horizontal' ? box.width : box.height
  const order = boxes.map((box, index) => ({ box, index }))
    .sort((a, b) => start(a.box) + size(a.box) / 2 - (start(b.box) + size(b.box) / 2) || a.index - b.index)
  const first = Math.min(...boxes.map(start))
  const last = Math.max(...boxes.map((box) => start(box) + size(box)))
  const gap = (last - first - boxes.reduce((total, box) => total + size(box), 0)) / (boxes.length - 1)
  let cursor = first
  for (const { box, index } of order) {
    const delta = cursor - start(box)
    offsets[index] = axis === 'horizontal' ? { dx: delta, dy: 0 } : { dx: 0, dy: delta }
    cursor += size(box) + gap
  }
  return offsets
}

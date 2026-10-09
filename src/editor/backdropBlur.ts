import { Canvas2dFilterBackend, filters } from 'fabric'
import type { FabricObject } from 'fabric'

// Read the canvas immediately before this element renders, so only layers behind
// it are blurred. Recompute on every draw, including zoom, movement and export.
export function attachBackdropBlur(object: FabricObject, radius: number): void {
  const render = object.render.bind(object)
  object.objectCaching = false
  object.render = (ctx) => {
    if (object.visible && object.opacity > 0 && object.width > 0 && object.height > 0) {
      ctx.save()
      try {
        object.transform(ctx)
        const matrix = ctx.getTransform()
        const corners = [[-object.width / 2, -object.height / 2], [object.width / 2, -object.height / 2], [-object.width / 2, object.height / 2], [object.width / 2, object.height / 2]].map(([x, y]) => ({ x: matrix.a * x + matrix.c * y + matrix.e, y: matrix.b * x + matrix.d * y + matrix.f }))
        const pixels = radius * Math.max(Math.hypot(matrix.a, matrix.b), Math.hypot(matrix.c, matrix.d))
        const padding = Math.ceil(pixels * 3)
        const left = Math.max(0, Math.floor(Math.min(...corners.map((p) => p.x))) - padding)
        const top = Math.max(0, Math.floor(Math.min(...corners.map((p) => p.y))) - padding)
        const right = Math.min(ctx.canvas.width, Math.ceil(Math.max(...corners.map((p) => p.x))) + padding)
        const bottom = Math.min(ctx.canvas.height, Math.ceil(Math.max(...corners.map((p) => p.y))) + padding)
        if (right > left && bottom > top) {
          const snapshot = document.createElement('canvas')
          snapshot.width = right - left; snapshot.height = bottom - top
          const source = snapshot.getContext('2d')!
          source.drawImage(ctx.canvas, left, top, snapshot.width, snapshot.height, 0, 0, snapshot.width, snapshot.height)
          ctx.beginPath()
          ctx.rect(-object.width / 2, -object.height / 2, object.width, object.height)
          ctx.clip()
          ctx.resetTransform()
          ctx.globalAlpha *= object.opacity
          if (typeof ctx.filter === 'string') {
            ctx.filter = `blur(${pixels}px)`
            ctx.drawImage(snapshot, left, top)
          } else {
            const output = document.createElement('canvas')
            output.width = snapshot.width; output.height = snapshot.height
            new Canvas2dFilterBackend().applyFilters([new filters.Blur({ blur: Math.min(1, pixels / (0.12 * Math.min(snapshot.width, snapshot.height))) })], snapshot, snapshot.width, snapshot.height, output)
            ctx.drawImage(output, left, top)
          }
        }
      } finally { ctx.restore() }
    }
    render(ctx)
  }
}

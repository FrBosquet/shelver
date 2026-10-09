import { qrMatrix } from '../domain/qr'
import { tableIcons, tableIconSvg } from '../domain/tableIcons'
import { tableMarkdown } from './tableMarkdown'
import { pegiColor, pegiLayout } from '../domain/pegi'
import { Canvas2dFilterBackend, filters, FabricImage, Gradient, Group, Path, loadSVGFromString, util, Pattern, Rect, Shadow, Textbox } from 'fabric'
import type { FabricObject } from 'fabric'
import type { Asset, Element, ImageElement, ImageFilters } from '../domain/types'
import { attachBackdropBlur } from './backdropBlur'
import { builtinAsset } from '../assets/logoLibrary'

export function imageFilters(settings: ImageFilters = {}) {
  return [
    ...(settings.tint ? [new filters.BlendColor({ color: settings.tint, mode: 'tint', alpha: 1 })] : []),
    ...(settings.brightness ? [new filters.Brightness({ brightness: settings.brightness })] : []),
    ...(settings.contrast ? [new filters.Contrast({ contrast: settings.contrast })] : []),
    ...(settings.saturation ? [new filters.Saturation({ saturation: settings.saturation })] : []),
    ...(settings.grayscale ? [new filters.Grayscale()] : []),
    ...(settings.blur ? [new filters.Blur({ blur: settings.blur })] : []),
    ...(settings.invert ? [new filters.Invert({ alpha: false })] : []),
  ]
}

export function attachImageFit(frame: Rect, pattern: Pattern, element: ImageElement, asset: Pick<Asset, 'width' | 'height'>) {
  const update = () => {
    const scale = frame.getObjectScaling()
    const sx = Math.abs(scale.x), sy = Math.abs(scale.y)
    if (!sx || !sy) return
    const width = frame.width * sx, height = frame.height * sy
    const factor = (element.fit === 'cover'
      ? Math.max(width / asset.width, height / asset.height)
      : element.fit === 'contain' ? Math.min(width / asset.width, height / asset.height) : 1) * (element.imageScale ?? 1)
    const offsetX = ((width - asset.width * factor) * (element.focalX ?? 0.5) + (element.offsetX ?? 0)) / sx
    const offsetY = ((height - asset.height * factor) * (element.focalY ?? 0.5) + (element.offsetY ?? 0)) / sy
    const x = factor / sx, y = factor / sy
    if (pattern.offsetX !== offsetX || pattern.offsetY !== offsetY || pattern.patternTransform?.[0] !== x || pattern.patternTransform?.[3] !== y) {
      pattern.offsetX = offsetX
      pattern.offsetY = offsetY
      pattern.patternTransform = [x, 0, 0, y, 0, 0]
      frame.dirty = true
    }
  }
  // Refit before rendering, including live drags, multi-selections and exports.
  const render = frame.render
  frame.render = function (ctx) {
    update()
    render.call(this, ctx)
  }
  frame.on('scaling', update)
  frame.set({ noScaleCache: false })
  update()
}

export async function renderElement(element: Element, assets: Record<string, Asset>, signal: AbortSignal, editableReplacement = false): Promise<FabricObject> {
  if (element.type === 'table') element = { ...element, width: element.width * element.scaleX, height: element.height * element.scaleY, scaleX: 1, scaleY: 1 }
  let object: FabricObject
  if (element.type === 'text') {
    object = new Textbox(element.text, { width: element.width, fontFamily: element.fontFamily, fontSize: element.fontSize, fill: element.fill,
      fontWeight: element.fontWeight ?? 'normal', textAlign: element.textAlign ?? 'left', lineHeight: element.lineHeight ?? 1.16 })
  } else if (element.type === 'shape') {
    object = new Rect({ fill: element.gradientTo ? new Gradient({ type: 'linear', gradientUnits: 'percentage', coords: { x1: 0, y1: 0, x2: 1, y2: 0 }, colorStops: [{ offset: 0, color: element.fill }, { offset: 1, color: element.gradientTo }] }) : element.fill })
  } else if (element.type === 'table') {
    const rows = element.cells.length, columns = element.cells[0].length
    const width = element.width / columns, height = element.height / rows
    const padding = element.padding ?? 8
    const verticalAlign = element.verticalAlign ?? 'top'
    const contentTop = (cellHeight: number, contentHeight: number) => {
      const free = Math.max(0, cellHeight - padding * 2 - contentHeight)
      return padding + (verticalAlign === 'middle' ? free / 2 : verticalAlign === 'bottom' ? free : 0)
    }
    const cells: FabricObject[] = []
    const layouts: { row: number; column: number; frame: Rect; text: Textbox; icon?: FabricObject }[] = []
    for (const [r, row] of element.cells.entries()) for (const [c, cell] of row.entries()) {
      const frame = new Rect({ originX: 'left', originY: 'top', left: c * width, top: r * height, width, height, fill: element.fill, stroke: element.textColor, strokeWidth: 1 })
      cells.push(frame)
      const icon = tableIcons.find((entry) => entry.id === element.icons?.[r]?.[c])
      const iconSize = Math.max(1, Math.min(24, width - padding * 2))
      let iconOffset = 0
      let artwork: FabricObject | undefined
      if (icon) {
        const svg = await loadSVGFromString(tableIconSvg(icon, element.textColor), undefined, { signal })
        artwork = util.groupSVGElements(svg.objects.filter((item): item is FabricObject => item !== null), svg.options)
        artwork.set({ originX: 'left', originY: 'top', left: c * width + (width - iconSize) / 2, top: r * height + padding, scaleX: iconSize / 24, scaleY: iconSize / 24 })
        iconOffset = iconSize + 8
        cells.push(artwork)
      }
      const markdown = element.contentFormat === 'markdown' ? tableMarkdown(cell) : { text: cell, styles: {} }
      const text = new Textbox(markdown.text, { originX: 'left', originY: 'top', styles: markdown.styles, lineHeight: 1.15, left: c * width + padding, top: r * height + padding + iconOffset, textAlign: element.textAlign ?? (icon ? 'center' : 'left'), width: Math.max(1, width - padding * 2), fontSize: element.fontSize, fontFamily: element.fontFamily ?? 'Arial', fill: element.textColor })
      const top = r * height + contentTop(height, iconOffset + text.height)
      text.set({ top: top + iconOffset })
      artwork?.set({ top })
      cells.push(text)
      layouts.push({ row: r, column: c, frame, text, icon: artwork })
    }
    const group = new Group(cells)
    // Resize the frame during a drag while counteracting group scale on content.
    group.on('scaling', () => {
      const sx = group.scaleX, sy = group.scaleY
      if (sx <= 0 || sy <= 0) return
      const cellWidth = group.width * sx / columns, cellHeight = group.height * sy / rows
      for (const layout of layouts) {
        const left = layout.column * cellWidth, top = layout.row * cellHeight
        layout.frame.set({ left: left / sx - group.width / 2, top: top / sy - group.height / 2, width: cellWidth / sx, height: cellHeight / sy })
        const size = Math.max(1, Math.min(24, cellWidth - padding * 2))
        layout.text.set({ width: Math.max(1, cellWidth - padding * 2), scaleX: 1 / sx, scaleY: 1 / sy })
        const offset = layout.icon ? size + 8 : 0
        const contentY = top + contentTop(cellHeight, offset + layout.text.height)
        layout.text.set({ left: (left + padding) / sx - group.width / 2, top: (contentY + offset) / sy - group.height / 2 })
        layout.icon?.set({ left: (left + (cellWidth - size) / 2) / sx - group.width / 2, top: contentY / sy - group.height / 2,
          scaleX: size / 24 / sx, scaleY: size / 24 / sy })
      }
      group.dirty = true
    })
    object = group
  } else if (element.type === 'qr') {
    const matrix = qrMatrix(element.url)
    const size = Math.min(element.width, element.height)
    const left = (element.width - size) / 2, top = (element.height - size) / 2
    const parts: FabricObject[] = [
      new Rect({ originX: 'left', originY: 'top', left: 0, top: 0, width: element.width, height: element.height, fill: 'transparent', strokeWidth: 0 }),
      new Rect({ originX: 'left', originY: 'top', left, top, width: size, height: size, fill: '#ffffff', strokeWidth: 0 }),
    ]
    if (matrix) {
      const cell = size / (matrix.length + 8)
      // Four white modules around the symbol remain part of the component.
      const commands = matrix.flatMap((row, y) => row.flatMap((dark, x) => dark
        ? [`M ${left + (x + 4) * cell} ${top + (y + 4) * cell} h ${cell} v ${cell} h ${-cell} z`] : []))
      parts.push(new Path(commands.join(' '), { originX: 'left', originY: 'top', left: left + 4 * cell, top: top + 4 * cell, fill: '#000000', strokeWidth: 0 }))
    } else {
      parts.push(new Textbox('Enter a valid URL', { originX: 'left', originY: 'top', left: left + size * 0.1, top: top + size * 0.35, width: size * 0.8, fontSize: size * 0.12, textAlign: 'center', fill: '#000000' }))
    }
    object = new Group(parts)
  } else if (element.type === 'rating') {
    const badge = pegiLayout(element.width, element.height)
    const { left, top, width, height, border, inset, square } = badge
    object = new Group([
      new Rect({ originX: 'left', originY: 'top', width: element.width, height: element.height, fill: 'transparent', strokeWidth: 0 }),
      new Rect({ originX: 'left', originY: 'top', left, top, width, height, fill: '#000000', strokeWidth: 0 }),
      new Rect({ originX: 'left', originY: 'top', left: left + border, top: top + border, width: width - border * 2, height: height - border * 2, fill: '#ffffff', strokeWidth: 0 }),
      new Rect({ originX: 'left', originY: 'top', left: left + inset, top: top + inset, width: square, height: square, fill: pegiColor(element.rating), strokeWidth: 0 }),
      new Textbox(element.rating, { originX: 'left', originY: 'top', left: left + inset, top: top + inset - square * 0.025, width: square, fontSize: badge.numberSize, fontWeight: 'bold', fontFamily: 'Arial Narrow, Arial', fill: '#ffffff', textAlign: 'center', lineHeight: 1 }),
      new Textbox('TM', { originX: 'left', originY: 'top', left: left + width * 0.85, top: top + inset, width: width * 0.12, fontSize: width * 0.065, fontFamily: 'Arial', fill: '#ffffff', textAlign: 'center', lineHeight: 1 }),
      new Textbox('www.pegi.info', { originX: 'left', originY: 'top', left: left + inset, top: top + inset + square + width * 0.015, width: square, fontSize: badge.footerSize, fontFamily: 'Arial', fill: '#000000', textAlign: 'center', lineHeight: 1 }),
    ])
  } else {
    const asset = builtinAsset(element.assetId) ?? assets[element.assetId]
    if (!asset) throw new Error(`Missing artwork: ${element.name}`)
    const url = URL.createObjectURL(asset.blob)
    try {
      object = await FabricImage.fromURL(url, { signal })
      if (element.filters && object instanceof FabricImage) {
        const adjustments = imageFilters(element.filters)
        if (adjustments.length) {
          // Process image pixels in 2D so RGB adjustments preserve the original
          // alpha channel, including transparent margins and antialiased edges.
          const output = document.createElement('canvas')
          output.width = asset.width
          output.height = asset.height
          const backend = new Canvas2dFilterBackend()
          if (!backend.applyFilters(adjustments, object.getElement(), asset.width, asset.height, output)) throw new Error('Unable to filter this image.')
          object.setElement(output)
        }
      }
    } finally {
      URL.revokeObjectURL(url)
    }
  }
  object.set({
    originX: 'left', originY: 'top',
    left: element.x, top: element.y, width: element.width,
    ...(element.type !== 'text' ? { height: element.height } : {}),
    scaleX: element.scaleX, scaleY: element.scaleY, angle: element.rotation,
    opacity: element.opacity, visible: element.visible,
    ...(element.type === 'table' ? { lockScalingFlip: true } : {}),
    selectable: !element.locked, evented: !element.locked,
    cornerColor: '#c2e3b5', borderColor: '#c2e3b5', cornerStyle: 'circle', transparentCorners: false,
  })
  if (element.type === 'image' && element.fit && object instanceof FabricImage) {
    const source = object.getElement()
    const asset = builtinAsset(element.assetId) ?? assets[element.assetId]
    const pattern = new Pattern({ source, repeat: element.fit === 'repeat' ? 'repeat' : 'no-repeat' })
    const frame = new Rect({ ...object.toObject(), strokeWidth: 0, fill: pattern })
    attachImageFit(frame, pattern, element, asset)
    object.dispose()
    object = frame
  }
  if (element.type === 'image') {
    const shadow = element.filters?.shadow
    if (shadow) object.set({ shadow: new Shadow({ color: `${shadow.color}${Math.round(shadow.opacity * 255).toString(16).padStart(2, '0')}`, blur: shadow.blur, offsetX: shadow.offsetX, offsetY: shadow.offsetY }) })
    if (element.filters?.backdropBlur) attachBackdropBlur(object, element.filters.backdropBlur)
  }
  if (element.blockId && !editableReplacement && object instanceof Textbox) object.set({ editable: false })
  return object
}

export function readElement(object: FabricObject, original: Element): Element {
  const base = {
    ...original, x: object.left, y: object.top, width: object.width, height: object.height,
    scaleX: object.scaleX, scaleY: object.scaleY, rotation: object.angle,
    opacity: object.opacity, visible: object.visible,
  }
  if (original.type === 'table') return { ...base, width: object.width * object.scaleX, height: object.height * object.scaleY, scaleX: 1, scaleY: 1 }
  if (original.type === 'text' && object instanceof Textbox) {
    return { ...base, height: original.blockId ? original.height : base.height, type: 'text', text: object.text, fontFamily: object.fontFamily, fontSize: object.fontSize, fill: String(object.fill) }
  }
  return base
}

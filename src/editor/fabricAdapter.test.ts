import { ActiveSelection, Canvas2dFilterBackend, FabricImage, Gradient, Group, Path, Pattern, Rect } from 'fabric'
import { describe, expect, it, vi } from 'vitest'
import type { ShapeElement, TextElement } from '../domain/types'
import type { Transform } from 'fabric'
import { qrMatrix } from '../domain/qr'
import { AlignedTextbox, renderElement, imageFilters, readElement, attachImageFit } from './fabricAdapter'
import { selectionStyle } from './selectionStyle'

const shape: ShapeElement = {
  id: 'shape', name: 'Shape', type: 'shape', fill: '#ffffff',
  x: 0, y: 0, width: 100, height: 100, scaleX: 1, scaleY: 1,
  rotation: 0, opacity: 1, visible: true, locked: false,
}

describe('template canvas interaction', () => {
  it('renders text Markdown without fixed template bold and preserves the source after moving', async () => {
    const original: TextElement = { ...shape, type: 'text', text: 'Plain **bold**\n*italic*', fontSize: 24, fontFamily: 'Arial', fontWeight: 'bold', lineHeight: 1.5, charSpacing: 120, shadow: { color: '#123456', opacity: 0.5, blur: 8, offsetX: -3, offsetY: 4 } }
    const split = vi.spyOn(AlignedTextbox.prototype, 'graphemeSplit').mockImplementation((text) => Array.from(text))
    const measure = vi.spyOn(AlignedTextbox.prototype, '_measureChar').mockReturnValue({ width: 10, kernedWidth: 10 })
    try {
      const object = await renderElement(original, {}, new AbortController().signal) as AlignedTextbox
      expect(object.text).toBe('Plain bold\nitalic')
      expect(object.shadow).toMatchObject({ color: 'rgba(18,52,86,0.5)', blur: 8, offsetX: -3, offsetY: 4 })
      expect(readElement(object, original)).toMatchObject({ shadow: original.shadow })
      expect(object.toSVG()).toContain('feGaussianBlur')
      expect(object.lineHeight).toBe(1.5)
      expect(object.charSpacing).toBe(120)
      object.set({ lineHeight: 1.8, charSpacing: -50 })
      expect(object.fontWeight).toBe('normal')
      expect(object.styles[0][6]).toEqual({ fontWeight: 'bold' })
      expect(object.styles[0][0]).toBeUndefined()
      expect(object.styles[1][0]).toEqual({ fontStyle: 'italic' })
      object.set({ left: 50 })
      expect(readElement(object, original)).toMatchObject({ text: original.text, x: 50, lineHeight: 1.8, charSpacing: -50 })
      object.dispose()
    } finally { split.mockRestore(); measure.mockRestore() }
  })
  it.each(['mt', 'mb'] as const)('resizes the text frame from %s without stretching text and preserves the opposite edge', async (corner) => {
    const original: TextElement = { ...shape, type: 'text', blockId: 'description', text: 'First line\nSecond line', fontSize: 24, fontFamily: 'Arial', x: 40, y: 60, height: 100 }
    const split = vi.spyOn(AlignedTextbox.prototype, 'graphemeSplit').mockImplementation((text) => Array.from(text))
    const measure = vi.spyOn(AlignedTextbox.prototype, '_measureChar').mockReturnValue({ width: 10, kernedWidth: 10 })
    try {
    const object = await renderElement(original, {}, new AbortController().signal) as AlignedTextbox
    const originY = corner === 'mb' ? 'top' : 'bottom'
    const anchor = object.getPositionByOrigin('center', originY)
    const transform = { target: object, corner, originX: 'center', originY } as unknown as Transform
    const pointerY = corner === 'mb' ? anchor.y + 200 : anchor.y - 200
    expect(object.controls[corner].actionHandler!({} as MouseEvent, transform, anchor.x, pointerY)).toBe(true)
    expect(object.frameHeight).toBeCloseTo(200 - object.strokeWidth)
    expect(object.getPositionByOrigin('center', originY)).toEqual(anchor)
    expect(readElement(object, original)).toMatchObject({ height: object.frameHeight, scaleY: 1, scaleX: 1, fontSize: 24 })
    object.initDimensions()
    expect(object.height).toBe(object.frameHeight)
    object.dispose()
    } finally { split.mockRestore(); measure.mockRestore() }
  })

  it.each(['cover', 'contain', 'repeat'] as const)('preserves the shared gizmo style on %s images', async (fit) => {
    const source = { width: 100, height: 100, src: 'fixture.png' } as HTMLImageElement
    const image = new FabricImage(source)
    const load = vi.spyOn(FabricImage, 'fromURL').mockResolvedValue(image)
    const dispose = vi.spyOn(image, 'dispose').mockImplementation(() => {})
    try {
      const asset = { id: 'fixture', name: 'Fixture', mimeType: 'image/png', width: 100, height: 100, blob: new Blob() }
      const object = await renderElement({ ...shape, type: 'image', assetId: asset.id, fit }, { [asset.id]: asset }, new AbortController().signal)
      expect(object).toBeInstanceOf(Rect)
      expect(object).toMatchObject(selectionStyle)
      expect(object.selectable).toBe(true)
    } finally {
      load.mockRestore()
      dispose.mockRestore()
    }
  })

  it('saves canvas positions while elements belong to a moved multi-selection', async () => {
    const originals = [
      { ...shape, x: 40, y: 60, rotation: 15, scaleX: 1.2 },
      { ...shape, id: 'second', blockId: 'back-rating', x: 230, y: 180 },
    ]
    const objects = await Promise.all(originals.map((element) => renderElement(element, {}, new AbortController().signal)))
    const selection = new ActiveSelection(objects)
    objects.forEach((object, index) => {
      expect(readElement(object, originals[index]).x).toBeCloseTo(originals[index].x)
      expect(readElement(object, originals[index]).y).toBeCloseTo(originals[index].y)
    })
    selection.set({ left: selection.left + 75, top: selection.top - 25 })
    objects.forEach((object, index) => {
      const saved = readElement(object, originals[index])
      expect(saved.x).toBeCloseTo(originals[index].x + 75)
      expect(saved.y).toBeCloseTo(originals[index].y - 25)
      expect(saved.rotation).toBe(originals[index].rotation)
      expect(saved.scaleX).toBe(originals[index].scaleX)
    })
    selection.remove(...objects)
    objects.forEach((object, index) => {
      expect(readElement(object, originals[index]).x).toBeCloseTo(originals[index].x + 75)
      expect(readElement(object, originals[index]).y).toBeCloseTo(originals[index].y - 25)
    })
  })

  it('allows moving, resizing and rotating template elements', async () => {
    const object = await renderElement({ ...shape, blockId: 'back-rating' }, {}, new AbortController().signal)
    expect(object.selectable).toBe(true)
    expect(object.evented).toBe(true)
    expect(object.hasControls).toBe(true)
    expect(object.lockMovementX).toBe(false)
    expect(object.lockMovementY).toBe(false)
    expect(object.lockScalingX).toBe(false)
    expect(object.lockScalingY).toBe(false)
    expect(object.lockRotation).toBe(false)
  })

  it('keeps freely added elements movable and locked standalone elements protected', async () => {
    const object = await renderElement(shape, {}, new AbortController().signal)
    expect(object.selectable).toBe(true)
    expect(object.hasControls).toBe(true)
    expect(object.lockMovementX).toBe(false)
    const locked = await renderElement({ ...shape, locked: true }, {}, new AbortController().signal)
    expect(locked.selectable).toBe(false)
    expect(locked.evented).toBe(false)
  })
})


describe('Image filters', () => {
  it('leaves the original rendering unchanged with neutral settings', () => {
    expect(imageFilters()).toEqual([])
    expect(imageFilters({ brightness: 0, contrast: 0, saturation: 0, grayscale: false, invert: false })).toEqual([])
  })
  it('builds color and image adjustments in a consistent order', () => {
    const result = imageFilters({ tint: '#123456', brightness: 0.2, contrast: -0.1, saturation: 0.5, grayscale: true, invert: true })
    expect(result.map((filter) => filter.toObject())).toEqual([
      expect.objectContaining({ type: 'BlendColor', color: '#123456', mode: 'tint', alpha: 1 }),
      { type: 'Brightness', brightness: 0.2 },
      { type: 'Contrast', contrast: -0.1 },
      { type: 'Saturation', saturation: 0.5 },
      expect.objectContaining({ type: 'Grayscale' }),
      expect.objectContaining({ type: 'Invert', invert: true }),
    ])
  })
})


describe('Image transparency', () => {
  it.each([
    { tint: '#ff0000' }, { brightness: 0.5 }, { contrast: 0.5 },
    { saturation: 0.5 }, { grayscale: true }, { invert: true },
    { tint: '#ff0000', brightness: 0.2, contrast: -0.2, saturation: 0.5, grayscale: true, invert: true },
  ])('preserves transparent, translucent and opaque pixels for %j', (settings) => {
    const pixels = new Uint8ClampedArray([0, 0, 0, 0, 20, 80, 140, 128, 60, 120, 180, 255])
    const original = pixels.slice()
    let rendered: Uint8ClampedArray | undefined
    const ctx = {
      drawImage: () => {},
      getImageData: () => ({ data: pixels.slice(), width: 3, height: 1 }),
      putImageData: (image: { data: Uint8ClampedArray }) => { rendered = image.data },
    }
    const target = { getContext: () => ctx } as unknown as HTMLCanvasElement
    const source = {} as CanvasImageSource
    new Canvas2dFilterBackend().applyFilters(imageFilters(settings), source, 3, 1, target)
    expect([rendered![3], rendered![7], rendered![11]]).toEqual([0, 128, 255])
    expect(Array.from(rendered!).filter((_, index) => index % 4 !== 3)).not.toEqual(Array.from(original).filter((_, index) => index % 4 !== 3))
  })
})


describe('QR rendering', () => {
  it.each([[150, 150], [132, 91]])('keeps a square symbol and white quiet zone inside %s × %s', async (width, height) => {
    const object = await renderElement({ ...shape, type: 'qr', url: 'https://example.com/game', width, height }, {}, new AbortController().signal)
    expect(object).toBeInstanceOf(Group)
    expect(object.width).toBe(width)
    expect(object.height).toBe(height)
    const parts = (object as Group).getObjects()
    const background = parts[1]
    const symbol = parts[2]
    expect(background.fill).toBe('#ffffff')
    expect(background.width).toBe(Math.min(width, height))
    expect(background.height).toBe(background.width)
    expect(symbol).toBeInstanceOf(Path)
    expect(symbol.width).toBeCloseTo(symbol.height)
    expect(symbol.width).toBeLessThan(background.width)
    const margin = Math.min(width, height) * 4 / (qrMatrix('https://example.com/game')!.length + 8)
    const backgroundBounds = background.getBoundingRect()
    const symbolBounds = symbol.getBoundingRect()
    expect(symbolBounds.left - backgroundBounds.left).toBeCloseTo(margin)
    expect(symbolBounds.top - backgroundBounds.top).toBeCloseTo(margin)
    expect(backgroundBounds.left + backgroundBounds.width - symbolBounds.left - symbolBounds.width).toBeCloseTo(margin)
    expect(backgroundBounds.top + backgroundBounds.height - symbolBounds.top - symbolBounds.height).toBeCloseTo(margin)
    object.dispose()
  })
})

 it('stores resized table dimensions without scaling its typography, icons or padding', () => {
  const table = { ...shape, type: 'table' as const, width: 400, height: 80, cells: [['First', 'Second']], icons: [['player', 'controller']] as ('player' | 'controller')[][], fontSize: 14, textColor: '#000000', padding: 8 }
  const object = new Rect({ originX: 'left', originY: 'top', left: 40, top: 50, width: 400, height: 80, scaleX: 1.5, scaleY: 2.5 })
  expect(readElement(object, table)).toMatchObject({ width: 600, height: 200, scaleX: 1, scaleY: 1, fontSize: 14, padding: 8, icons: table.icons, x: 40, y: 50 })
})


describe('Image fit after resizing', () => {
  it.each(['cover', 'contain'] as const)('keeps %s artwork proportional at the final frame size and during a drag', (fit) => {
    const element = { ...shape, type: 'image' as const, assetId: 'art', fit }
    const frame = new Rect({ width: 100, height: 100, scaleX: 3, scaleY: 2 })
    const pattern = new Pattern({ source: {} as HTMLCanvasElement })
    attachImageFit(frame, pattern, element, { width: 200, height: 100 })
    const factor = fit === 'cover' ? 2 : 1.5
    expect(pattern.patternTransform![0] * frame.scaleX).toBeCloseTo(factor)
    expect(pattern.patternTransform![3] * frame.scaleY).toBeCloseTo(factor)
    expect(pattern.offsetX * frame.scaleX).toBeCloseTo((300 - 200 * factor) / 2)
    expect(pattern.offsetY * frame.scaleY).toBeCloseTo((200 - 100 * factor) / 2)
    frame.set({ scaleX: 1, scaleY: 4 })
    frame.fire('scaling')
    const resizedFactor = fit === 'cover' ? 4 : 0.5
    expect(pattern.patternTransform![0] * frame.scaleX).toBeCloseTo(resizedFactor)
    expect(pattern.patternTransform![3] * frame.scaleY).toBeCloseTo(resizedFactor)
    expect(pattern.offsetX * frame.scaleX).toBeCloseTo((100 - 200 * resizedFactor) / 2)
    expect(pattern.offsetY * frame.scaleY).toBeCloseTo((400 - 100 * resizedFactor) / 2)
  })
})


describe('box fills', () => {
  it.each(['linear', 'radial'] as const)('renders a %s gradient with destination transparency and preserves it after transforms', async (fillMode) => {
    const original: ShapeElement = { ...shape, fillMode, gradientTo: '#123456', gradientToOpacity: 0.25 }
    const object = await renderElement(original, {}, new AbortController().signal)
    expect(object.fill).toBeInstanceOf(Gradient)
    const fill = object.fill as Gradient<'linear'> | Gradient<'radial'>
    expect(fill.type).toBe(fillMode)
    expect(fill.colorStops[1]).toMatchObject({ offset: 1, color: 'rgba(18,52,86,0.25)' })
    object.set({ left: 20, angle: 45 })
    expect(readElement(object, original)).toMatchObject({ fillMode, gradientTo: '#123456', gradientToOpacity: 0.25, x: 20, rotation: 45 })
  })

  it('keeps legacy gradients and allows switching them to solid', async () => {
    const original: ShapeElement = { ...shape, gradientTo: '#000000' }
    const legacy = await renderElement(original, {}, new AbortController().signal)
    expect((legacy.fill as Gradient<'linear'>).type).toBe('linear')
    const solid = await renderElement({ ...original, fillMode: 'solid' }, {}, new AbortController().signal)
    expect(solid.fill).toBe(shape.fill)
  })
})

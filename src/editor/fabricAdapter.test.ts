import { Canvas2dFilterBackend, Group, Path, Rect } from 'fabric'
import { describe, expect, it } from 'vitest'
import type { ShapeElement } from '../domain/types'
import { qrMatrix } from '../domain/qr'
import { renderElement, imageFilters, readElement } from './fabricAdapter'

const shape: ShapeElement = {
  id: 'shape', name: 'Shape', type: 'shape', fill: '#ffffff',
  x: 0, y: 0, width: 100, height: 100, scaleX: 1, scaleY: 1,
  rotation: 0, opacity: 1, visible: true, locked: false,
}

describe('template canvas interaction', () => {
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

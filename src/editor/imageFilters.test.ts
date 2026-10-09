import { describe, expect, it } from 'vitest'
import { updateImageFilters } from './imageFilters'

describe('Selected image filters', () => {
  it('applies one filter to images with different settings while preserving their other filters', () => {
    const images = [{ contrast: 0.2, tint: '#123456' }, { blur: 0.4, grayscale: true }]
    expect(images.map((filters) => updateImageFilters(filters, { brightness: 0.5 }))).toEqual([
      { contrast: 0.2, tint: '#123456', brightness: 0.5 },
      { blur: 0.4, grayscale: true, brightness: 0.5 },
    ])
    expect(images[0]).toEqual({ contrast: 0.2, tint: '#123456' })
  })

  it('changes a shadow property without copying other images’ shadow settings', () => {
    const shadow = { color: '#123456', opacity: 0.3, blur: 20, offsetX: 5, offsetY: -7 }
    expect(updateImageFilters({ shadow, invert: true }, {}, { blur: 10 })).toEqual({ invert: true, shadow: { ...shadow, blur: 10 } })
    expect(updateImageFilters(undefined, {}, { blur: 10 }).shadow).toEqual({ color: '#000000', opacity: 0.6, blur: 10, offsetX: 0, offsetY: 0 })
  })

  it('resets all filters and allows disabling tint and shadows', () => {
    expect(updateImageFilters({ blur: 0.2, invert: true }, null)).toEqual({})
    expect(updateImageFilters({ tint: '#123456', tintRole: 'brand', contrast: 0.2 }, { tint: undefined, tintRole: undefined })).toEqual({ tint: undefined, tintRole: undefined, contrast: 0.2 })
    expect(updateImageFilters({ shadow: { color: '#000000', opacity: 1, blur: 2, offsetX: 0, offsetY: 0 } }, { shadow: undefined }).shadow).toBeUndefined()
  })
})

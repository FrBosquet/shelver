import { describe, expect, it } from 'vitest'
import { sniffRasterType } from './imageFormat'

describe('sniffRasterType', () => {
  it('detects formats from their bytes', () => {
    expect(sniffRasterType(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))).toBe('image/png')
    expect(sniffRasterType(new Uint8Array([255, 216, 255, 224]))).toBe('image/jpeg')
    expect(sniffRasterType(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp')
  })

  it('returns null for formats that must be converted, such as TIFF', () => {
    expect(sniffRasterType(new Uint8Array([73, 73, 42, 0, 8, 0, 0, 0]))).toBeNull()
    expect(sniffRasterType(new Uint8Array([77, 77, 0, 42]))).toBeNull()
  })
})

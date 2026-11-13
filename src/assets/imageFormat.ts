export type RasterMimeType = 'image/png' | 'image/jpeg' | 'image/webp'

/**
 * Detects a supported raster format from the file's own bytes.
 * File extensions (and the MIME type a browser derives from them) can lie:
 * a TIFF, PNG or AVIF renamed to ".jpg" still reports "image/jpeg".
 */
export function sniffRasterType(bytes: Uint8Array): RasterMimeType | null {
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return 'image/png'
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg'
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'image/webp'
  return null
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end))
}

/**
 * Returns the image as PNG, JPEG or WebP labelled with its real type.
 * Images in any other format the browser can decode (TIFF in Safari/WebKit,
 * AVIF, GIF, BMP…) are re-encoded as PNG so every browser can open them.
 */
export async function normalizeRasterImage(blob: Blob): Promise<{ blob: Blob; mimeType: RasterMimeType; width: number; height: number }> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const detected = sniffRasterType(bytes)
  const bitmap = await createImageBitmap(detected && blob.type !== detected ? new Blob([bytes], { type: detected }) : blob)
  try {
    const { width, height } = bitmap
    if (detected) return { blob: blob.type === detected ? blob : new Blob([bytes], { type: detected }), mimeType: detected, width, height }
    return { blob: await encodePng(bitmap), mimeType: 'image/png', width, height }
  } finally { bitmap.close() }
}

async function encodePng(bitmap: ImageBitmap): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Unable to convert this image.')
    context.drawImage(bitmap, 0, 0)
    return canvas.convertToBlob({ type: 'image/png' })
  }
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Unable to convert this image.')
  context.drawImage(bitmap, 0, 0)
  return new Promise((resolve, reject) => canvas.toBlob((png) => png ? resolve(png) : reject(new Error('Unable to convert this image.')), 'image/png'))
}

export async function imageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  if (blob.type !== 'image/svg+xml') {
    const bitmap = await createImageBitmap(blob)
    try { return { width: bitmap.width, height: bitmap.height } }
    finally { bitmap.close() }
  }
  if (!isSvgDocument(await blob.text())) throw new Error('Use a valid SVG image without scripts or embedded HTML.')
  const url = URL.createObjectURL(blob)
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => image.naturalWidth > 0 && image.naturalHeight > 0
        ? resolve({ width: image.naturalWidth, height: image.naturalHeight })
        : reject(new Error('The SVG must have valid dimensions or a viewBox.'))
      image.onerror = () => reject(new Error('Unable to open this SVG.'))
      image.src = url
    })
  } finally { URL.revokeObjectURL(url) }
}

export function isSvgDocument(source: string): boolean {
  if (/<(?:script|foreignObject)\b|\bon[a-z]+\s*=|javascript\s*:/i.test(source)) return false
  return /^\s*(?:<\?xml[\s\S]*?\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg\b[^>]*\bxmlns\s*=\s*["']http:\/\/www\.w3\.org\/2000\/svg["'][^>]*(?:\/\s*>|>[\s\S]*<\/svg\s*>)\s*$/i.test(source.replace(/^\uFEFF/, ''))
}

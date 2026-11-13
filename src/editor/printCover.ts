/**
 * Print an already rendered cover; millimetres keep the output independent of editor zoom.
 * The page is A4 portrait because WebKit browsers ignore `@page { size: landscape }` and shrink
 * a landscape layout to fit, losing the real dimensions. The cover is rotated in pixels rather
 * than with a CSS transform, so the print document stays a plain image the browser lays out fast.
 */
export async function printCover(source: HTMLCanvasElement, width: number, height: number) {
  // Leave space for crop marks and the printer's non-printable edges.
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || width > 277 || height > 190) {
    throw new Error('The cover must fit within 277 × 190 mm, including space for cut guides. Adjust the print width.')
  }
  const rotated = document.createElement('canvas')
  rotated.width = source.height
  rotated.height = source.width
  const context = rotated.getContext('2d')
  if (!context) throw new Error('Unable to prepare the cover for printing.')
  context.translate(rotated.width, 0)
  context.rotate(Math.PI / 2)
  context.drawImage(source, 0, 0)
  const blob = await new Promise<Blob>((resolve, reject) => rotated.toBlob((value) => value ? resolve(value) : reject(new Error('Unable to prepare the cover for printing.')), 'image/png'))
  const url = URL.createObjectURL(blob)
  // On the sheet the cover is `height` mm wide and `width` mm tall.
  const sheetWidth = height, sheetHeight = width
  const frame = document.createElement('iframe')
  frame.title = 'Print cover'
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;left:-10000px;top:0'
  const cleanup = () => { frame.remove(); URL.revokeObjectURL(url) }
  document.body.append(frame)
  try {
    const doc = frame.contentDocument!
    const view = frame.contentWindow!
    doc.open()
    doc.write(`<!doctype html><html><head><title>Cover</title><style>
      @page { size: A4 portrait; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; width: 210mm; height: 297mm; }
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .page { position: relative; width: 210mm; height: 297mm; overflow: hidden; break-inside: avoid; }
      .cover { position: absolute; left: ${(210 - sheetWidth) / 2}mm; top: ${(297 - sheetHeight) / 2}mm; width: ${sheetWidth}mm; height: ${sheetHeight}mm; }
      img { display: block; width: 100%; height: 100%; }
      svg { position: absolute; left: -6mm; top: -6mm; width: ${sheetWidth + 12}mm; height: ${sheetHeight + 12}mm; overflow: visible; }
    </style></head><body><div class="page"><div class="cover"></div></div></body></html>`)
    doc.close()
    const cover = doc.querySelector('.cover')!
    const img = doc.createElement('img')
    img.alt = 'Cover artwork'
    img.src = url
    cover.append(img)
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', `-6 -6 ${sheetWidth + 12} ${sheetHeight + 12}`)
    svg.setAttribute('aria-label', 'Cut guides')
    const lines = [
      [-6, 0, -2, 0], [0, -6, 0, -2], [sheetWidth + 2, 0, sheetWidth + 6, 0], [sheetWidth, -6, sheetWidth, -2],
      [-6, sheetHeight, -2, sheetHeight], [0, sheetHeight + 2, 0, sheetHeight + 6],
      [sheetWidth + 2, sheetHeight, sheetWidth + 6, sheetHeight], [sheetWidth, sheetHeight + 2, sheetWidth, sheetHeight + 6],
    ]
    for (const [x1, y1, x2, y2] of lines) {
      const line = doc.createElementNS(svg.namespaceURI, 'line')
      for (const [key, value] of Object.entries({ x1, y1, x2, y2, stroke: '#000', 'stroke-width': 0.2 })) line.setAttribute(key, String(value))
      svg.append(line)
    }
    cover.append(svg)
    await img.decode()
    // Allow the isolated print document to finish layout before opening the native dialog.
    await new Promise<void>((resolve) => view.requestAnimationFrame(() => view.requestAnimationFrame(() => resolve())))
    view.addEventListener('afterprint', cleanup, { once: true })
    view.focus()
    view.print()
  } catch (cause) {
    cleanup()
    throw cause
  }
}

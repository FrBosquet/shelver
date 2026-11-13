/**
 * Print an already rendered cover; millimetres keep the output independent of editor zoom.
 * The cover is rotated onto an A4 portrait sheet: WebKit browsers ignore `@page { size: landscape }`
 * and shrink a landscape layout to fit the portrait default, which loses the real dimensions.
 */
export async function printCover(source: string, width: number, height: number) {
  // Leave space for crop marks and the printer's non-printable edges.
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || width > 277 || height > 190) {
    throw new Error('The cover must fit within 277 × 190 mm, including space for cut guides. Adjust the print width.')
  }
  const frame = document.createElement('iframe')
  frame.title = 'Print cover'
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;left:-10000px;top:0'
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
      .slot { position: absolute; left: ${(210 - height) / 2}mm; top: ${(297 - width) / 2}mm; width: ${height}mm; height: ${width}mm; }
      .cover { position: absolute; left: 0; top: 0; width: ${width}mm; height: ${height}mm; transform-origin: 0 0; transform: translateX(${height}mm) rotate(90deg); }
      img { display: block; width: 100%; height: 100%; }
      svg { position: absolute; left: -6mm; top: -6mm; width: ${width + 12}mm; height: ${height + 12}mm; overflow: visible; }
    </style></head><body><div class="page"><div class="slot"><div class="cover"></div></div></div></body></html>`)
    doc.close()
    const cover = doc.querySelector('.cover')!
    const img = doc.createElement('img')
    img.alt = 'Cover artwork'
    img.src = source
    cover.append(img)
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', `-6 -6 ${width + 12} ${height + 12}`)
    svg.setAttribute('aria-label', 'Cut guides')
    const lines = [
      [-6, 0, -2, 0], [0, -6, 0, -2], [width + 2, 0, width + 6, 0], [width, -6, width, -2],
      [-6, height, -2, height], [0, height + 2, 0, height + 6],
      [width + 2, height, width + 6, height], [width, height + 2, width, height + 6],
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
    view.addEventListener('afterprint', () => frame.remove(), { once: true })
    view.focus()
    view.print()
  } catch (cause) {
    frame.remove()
    throw cause
  }
}

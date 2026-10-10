import { applySteamLayout } from './steamLayout'
import { tableIcons } from './tableIcons'
import { elementAssetIds, remapElementAssets } from './elementTypes'
import type { ColorRole, CoverDesign, DesignBlock, Element, ElementOverride, Format, Placement, Project, RatingElement, TextRole } from './types'
import { defaultImageAssetId, steamLogoFor } from '../assets/logoLibrary'

export function placementOf(element: Element, format: Format, panelId?: DesignBlock['panel']): Placement {
  const panel = format.panels.find((p) => p.id === panelId) ?? [...format.panels].reverse().find((p) => element.x >= p.x) ?? format.panels[0]
  return { panel: panel.id, referenceWidth: panel.width, referenceHeight: format.height, referenceX: panel.x,
    x: element.x, y: element.y, width: element.width, height: element.height, scaleX: element.scaleX, scaleY: element.scaleY, rotation: element.rotation }
}

export function adaptElement(element: Element, placement: Placement, format: Format): Element {
  const panel = format.panels.find((p) => p.id === placement.panel) ?? format.panels[0]
  const sx = panel.width / placement.referenceWidth, sy = format.height / placement.referenceHeight, scale = Math.min(sx, sy)
  const adapted = { ...element, x: panel.x + (placement.x - placement.referenceX) * sx, y: placement.y * sy, rotation: placement.rotation }
  if (element.type === 'image') return { ...adapted, width: placement.width, height: placement.height, scaleX: placement.scaleX * scale, scaleY: placement.scaleY * scale }
  return { ...adapted, width: placement.width * sx, height: placement.height * sy, scaleX: placement.scaleX, scaleY: placement.scaleY,
    ...(element.type === 'text' || element.type === 'table' ? { fontSize: element.fontSize * scale } : {}) }
}

export function composeDesign(project: Project): Project {
  let design = project.composition.design
  if (!design) return project
  if (design.blocks.some((block) => block.kind === 'barcode')) {
    design = structuredClone(design)
    for (const block of design.blocks) {
      if (block.kind !== 'barcode') continue
      block.kind = 'qr'
      block.name = 'QR code'
      const prefix = `${design.instanceId}:${block.id}:`
      for (const id of Object.keys(design.overrides)) {
        if (id.startsWith(prefix) && id !== `${prefix}code`) delete design.overrides[id]
      }
    }
    delete design.images.barcode
  }
  const { format } = project.composition
  const result: Element[] = []
  const colors = design.styles.colors
  // A footer surface is independent of the editable content blocks inside it.
  const back = format.panels.find((p) => p.id === 'back')!
  result.push({ id: `${design.instanceId}:technical-surface`, name: 'Technical footer background', type: 'shape', fill: colors.technical,
    x: back.x, y: format.height * 0.635, width: back.width, height: format.height * 0.365, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, visible: true, locked: false, styleRef: 'color.technical' })
  for (const block of design.blocks) {
    if (block.hidden) continue
    const panel = format.panels.find((p) => p.id === block.panel)!
    const x = panel.x + block.x * panel.width, y = block.y * format.height, w = block.width * panel.width, h = block.height * format.height
    const typeScale = Math.min(panel.width / 600, format.height / 960)
    const base = (key: string, name: string, dx = 0, dy = 0, dw = w, dh = h) => ({
      id: `${design.instanceId}:${block.id}:${key}`, blockId: block.id, name, x: x + dx, y: y + dy, width: Math.max(1, dw), height: Math.max(1, dh),
      scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, visible: true, locked: false,
    })
    const shape = (key: string, color: ColorRole, dx = 0, dy = 0, dw = w, dh = h, gradientTo?: string, locked = true) => {
      result.push({ ...base(key, block.name, dx, dy, dw, dh), type: 'shape', fill: colors[color], gradientTo, locked, styleRef: `color.${color}` })
    }
    const text = (key: string, value: string, role: TextRole, dx = 0, dy = 0, dw = w, dh = h, extra: Partial<Extract<Element, { type: 'text' }>> = {}) => {
      const style = design.styles.text[role]
      const labels: Partial<Record<DesignBlock['kind'], Record<string, string>>> = {
        title: { title: 'Title' },
        intro: { headline: 'Headline', synopsis: 'Synopsis' },
        review: { attribution: 'Review quote', quote: 'Review source' },
        publisher: { publisher: block.panel === 'back' ? 'Back publisher' : 'Publisher', legal: 'Legal' },
        spine: { publisher: 'Spine publisher', title: 'Spine title' },
      }
      result.push({ ...base(key, labels[block.kind]?.[key] ?? `${block.name} · ${key}`, dx, dy, dw, dh), type: 'text', text: value,
        fontRole: style.font, fontFamily: design.styles.fonts[style.font], fontSize: style.size * typeScale, fill: colors[style.color], fontWeight: style.weight, textAlign: style.align, lineHeight: 1.15, styleRef: role, ...extra })
    }
    const picture = (key: string, assetKey: string, label: string, dx = 0, dy = 0, dw = w, dh = h, contain = false, defaultAssetId?: string) => {
      const image = design.images[assetKey] ?? { assetId: defaultAssetId ?? defaultImageAssetId, fit: defaultAssetId ? 'contain' as const : 'cover' as const, focalX: 0.5, focalY: 0.5 }
      result.push({ ...base(key, label, dx, dy, dw, dh), type: 'image', assetId: image.assetId, fit: contain ? 'contain' : image.fit, focalX: image.focalX, focalY: image.focalY })
    }
    switch (block.kind) {
      case 'artwork':
        picture('art', block.panel === 'front' ? 'frontArt' : 'backArt', block.name)
        break
      case 'platform':
        shape('surface', 'brand', 0, 0, w * 0.75, h, `${colors.brand}00`, false)
        picture('logo', 'platformLogo', 'Steam logo', w * 0.04, h * 0.15, w * 0.35, h * 0.7, true, steamLogoFor(colors.brand))
        break
      case 'title':
        if (design.images.gameLogo) picture('logo', 'gameLogo', 'Game logo', 0, 0, w, h, true)
        else text('title', design.shared.title, 'title', 0, 0, w, h)
        break
      case 'intro':
        text('headline', design.shared.headline, 'headline', 0, 0, w, h * 0.34)
        text('synopsis', design.shared.synopsis, 'body', 0, h * 0.36, w, h * 0.64)
        break
      case 'gallery': {
        const columns = Math.min(3, Math.max(1, block.items.length)), rows = Math.max(1, Math.ceil(block.items.length / columns))
        const gap = w * 0.025, cell = (w - gap * (columns - 1)) / columns, rowHeight = h / rows
        block.items.forEach((item, i) => {
          const left = (i % columns) * (cell + gap), top = Math.floor(i / columns) * rowHeight
          picture(`${item.id}-image`, item.id, `Screenshot ${i + 1}`, left, top, cell, rowHeight * 0.62)
          text(`${item.id}-caption`, item.title, 'caption', left, top + rowHeight * 0.68, cell, rowHeight * 0.32, { name: `Screenshot ${i + 1} caption` })
        }); break
      }
      case 'review':
        text('quote', design.shared.quote, 'quote', 0, 0, w, h * 0.55)
        text('attribution', design.shared.attribution, 'caption', 0, h * 0.65, w, h * 0.3)
        break
      case 'requirements': {
        const previousText = (key: string, fallback: string) => {
          const override = design.overrides[`${design.instanceId}:${block.id}:${key}`]
          return override?.replacement?.type === 'text' ? override.replacement.text : override?.text ?? fallback
        }
        const column = (index: number, heading: string) => `### ${previousText(`heading-${index}`, heading)}\n` + block.items.map((item) =>
          `- **${previousText(`${item.id}-label-${index}`, item.title)}:** ${previousText(`${item.id}-value-${index}`, index ? item.detail : item.text)}`).join('\n')
        result.push({ ...base('table', block.name), type: 'table', contentFormat: 'markdown',
          cells: [[column(0, 'REQUISITOS MÍNIMOS (PC)'), column(1, 'REQUISITOS RECOMENDADOS (PC)')]],
          fill: colors.technical, textColor: colors.onTechnical,
          fontRole: 'technical', fontFamily: design.styles.fonts.technical, fontSize: design.styles.text.technical.size * typeScale, styleRef: 'technical' })
        break
      }
      case 'features': {
        const items = block.items.length ? block.items : [{ id: 'player', title: 'SINGLE PLAYER', text: '', detail: '' }]
        result.push({ ...base('table', block.name), type: 'table', cells: [items.map((item) => item.title)],
          icons: [items.map((item) => tableIcons.find((icon) => icon.id === item.id)?.id ?? null)],
          padding: 3, verticalAlign: 'middle', fill: colors.technical, textColor: colors.onTechnical, fontRole: 'technical', fontFamily: design.styles.fonts.technical, fontSize: design.styles.text.legal.size * typeScale, styleRef: 'legal' })
        break
      }
      case 'rating': {
        const count = 1 + block.items.length, gap = w * 0.035
        const rx = gap, ry = h * 0.06, rh = h * 0.88
        // The unified badge supplies its own white background and border.
        const cell = Math.min(rh * 0.75, (w - gap * (count + 1)) / count)
        if (design.images.ratingLogo) picture('rating', 'ratingLogo', 'Rating badge', rx, ry, cell, rh, true)
        else result.push({ ...base('rating', 'PEGI', rx, ry, cell, rh), type: 'rating', rating: design.shared.rating as RatingElement['rating'] })

        block.items.forEach((item, i) => {
          const left = gap + (i + 1) * (cell + gap)
          shape(`${item.id}-surface`, 'technical', left, ry, cell, rh)
          if (design.images[item.id]) picture(`${item.id}-icon`, item.id, item.title, left + cell * 0.1, ry, cell * 0.8, rh * 0.6, true)
          else text(`${item.id}-icon`, '◇', 'label', left, ry, cell, rh * 0.6, { textAlign: 'center', fontSize: Math.min(cell * 0.65, rh * 0.5) })
          text(`${item.id}-label`, item.title, 'legal', left + cell * 0.03, ry + rh * 0.65, cell * 0.94, rh * 0.35, { textAlign: 'center', fontSize: 9 * typeScale })
        }); break
      }
      case 'publisher':
        if (design.images.publisherLogo) picture('logo', 'publisherLogo', 'Publisher logo', 0, 0, w, block.panel === 'back' ? h * 0.46 : h, true)
        else text('publisher', design.shared.publisher, block.panel === 'back' ? 'label' : 'caption', 0, 0, w, h * 0.5, { fill: colors.onTechnical })
        if (block.panel === 'back') text('legal', design.shared.legal, 'legal', 0, h * 0.55, w, h * 0.45)
        break
      case 'qr':
        result.push({ ...base('code', 'QR code'), type: 'qr', url: 'https://store.steampowered.com/' })
        break
      case 'spine': {
        shape('background', 'spine')
        const fontScale = Math.min(w / 52, format.height / 960)
        picture('platform-logo', 'platformLogo', 'Steam logo', w * 0.8, h * 0.02, h * 0.18, w * 0.6, true, steamLogoFor(colors.spine))
        result[result.length - 1].rotation = 90
        ;(result[result.length - 1] as Extract<Element, { type: 'image' }>).focalX = 0
        if (design.images.gameLogo) {
          picture('game-logo', 'gameLogo', 'Game logo', w * 0.82, h * 0.29, h * 0.45, w * 0.64, true)
          result[result.length - 1].rotation = 90
        } else text('title', design.shared.title.replaceAll('\n', ' '), 'title', w * 0.8, h * 0.28, h * 0.48, w * 0.65, { fontSize: 28 * fontScale, fill: colors.onSpine, rotation: 90, textAlign: 'center' })
        if (design.images.publisherLogo) {
          picture('publisher-logo', 'publisherLogo', 'Publisher logo', w * 0.8, h * 0.82, h * 0.16, w * 0.6, true)
          result[result.length - 1].rotation = 90
          ;(result[result.length - 1] as Extract<Element, { type: 'image' }>).focalX = 1
        } else text('publisher', design.shared.publisher, 'legal', w * 0.8, h * 0.8, h * 0.18, w * 0.65, { fontSize: 12 * fontScale, fill: colors.onSpine, rotation: 90, textAlign: 'right' })
        break
      }
    }
  }
  const elements = result.map((generated) => {
    const element = design.steamLayoutVersion === 1 ? applySteamLayout(generated, format) : generated
    // Keep placement and visibility edits from the earlier text placeholders.
    const legacyId = element.id.replace(':platform:logo', ':platform:brand').replace(':spine:platform-logo', ':spine:platform')
    const override = design.overrides[element.id] ?? design.overrides[legacyId]
    if (!override) return element
    let source = override.replacement ?? element
    if (source.type === 'table' && source.blockId === 'requirements' && !source.contentFormat && source.cells[0]?.length === 3) {
      const oldCells = source.cells
      source = { ...source, contentFormat: 'markdown', cells: [[1, 2].map((column) =>
        `### ${oldCells[0][column]}\n` + oldCells.slice(1).map((row) => `- **${row[0]}:** ${row[column]}`).join('\n'))] }
    }
    let resolved = override.placement ? adaptElement(source, override.placement, format) : source
    if (resolved.type === 'text') resolved = { ...resolved,
      ...(!override.replacement && element.type === 'text' ? { fontSize: element.fontSize } : {}),
      ...(override.fontRole ? { fontRole: override.fontRole } : override.fontFamily ? { fontRole: undefined } : {}),
      ...(override.text !== undefined ? { text: override.text } : {}), ...(override.fontFamily ? { fontFamily: override.fontFamily } : {}),
      ...(override.fontSize ? { fontSize: override.fontSize * (override.placement ? Math.min(format.height / override.placement.referenceHeight, format.panels.find((p) => p.id === override.placement!.panel)!.width / override.placement.referenceWidth) : 1) } : {}),
      ...(override.fill ? { fill: override.fill } : {}) }
    if (resolved.type === 'shape' && override.fill) resolved = { ...resolved, fill: override.fill }
    return { ...resolved, visible: !override.hidden }
  })
  elements.push(...design.extras.map(({ element, placement }) => adaptElement(element, placement, format)))
  for (const element of elements) {
    if (element.type === 'image' && element.filters?.tint && element.filters.tintRole) {
      element.filters = { ...element.filters, tint: colors[element.filters.tintRole] }
    }
  }
  if (design.layerOrder) {
    const order = new Map(design.layerOrder.map((id, index) => [id, index]))
    elements.sort((a, b) => (order.get(a.id) ?? order.size) - (order.get(b.id) ?? order.size))
  }
  return { ...project, composition: { ...project.composition, background: colors.artwork, elements: elements.map((element) => (element.type === 'text' || element.type === 'table') && element.fontRole ? { ...element, fontFamily: design.styles.fonts[element.fontRole] } : element), design } }
}

export function captureDesignEdits(project: Project, elements: Element[]): Project {
  if (!project.composition.design) return { ...project, composition: { ...project.composition, elements } }
  const design = structuredClone(project.composition.design), { format } = project.composition
  const incoming = new Map(elements.map((el) => [el.id, el]))
  const previousOrder = project.composition.elements.filter((element) => incoming.has(element.id)).map((element) => element.id)
  const existingIds = new Set(previousOrder)
  const nextOrder = elements.filter((element) => existingIds.has(element.id)).map((element) => element.id)
  if (design.layerOrder || previousOrder.some((id, index) => id !== nextOrder[index])) {
    const savedOrder = design.layerOrder ?? project.composition.elements.map((element) => element.id)
    const reordered = elements.map((element) => element.id)
    let index = 0
    design.layerOrder = savedOrder.map((id) => incoming.has(id) ? reordered[index++] : id)
    design.layerOrder.push(...reordered.slice(index))
  }
  for (const previous of project.composition.elements.filter((el) => !design.extras.some((e) => e.element.id === el.id))) {
    const next = incoming.get(previous.id)
    const override: ElementOverride = design.overrides[previous.id] ?? {}
    if (!next) { override.hidden = true; design.overrides[previous.id] = override; continue }
    if (next.visible !== previous.visible) override.hidden = !next.visible
    if (next.type !== previous.type || override.replacement || (next.type === 'qr' && previous.type === 'qr' && next.url !== previous.url) || (next.type === 'table' && previous.type === 'table' && JSON.stringify(next) !== JSON.stringify(previous)) || (next.type === 'image' && previous.type === 'image' && ['filters', 'fit', 'imageScale', 'offsetX', 'offsetY', 'focalX', 'focalY'].some((key) => next[key as keyof typeof next] !== previous[key as keyof typeof previous]))) {
      design.overrides[previous.id] = { replacement: structuredClone(next), placement: placementOf(next, format), hidden: !next.visible }
      continue
    }
    if (next.type === 'rating' && previous.type === 'rating' && next.rating !== previous.rating) {
      design.shared.rating = next.rating
      delete design.images.ratingLogo
    }
    if (['x', 'y', 'width', 'height', 'scaleX', 'scaleY', 'rotation'].some((key) => Math.abs(previous[key as 'x'] - next[key as 'x']) > 0.000001)) {
      const block = design.blocks.find((b) => b.id === previous.blockId)
      override.placement = placementOf(next, format, block?.panel)
    }
    if (next.type === 'shape' && previous.type === 'shape' && next.fill !== previous.fill) override.fill = next.fill
    if (next.type === 'text' && previous.type === 'text') {
      if (next.text !== previous.text) override.text = next.text
      if (next.fill !== previous.fill) override.fill = next.fill
      if (next.fontRole !== previous.fontRole && next.fontRole) override.fontRole = next.fontRole
      if (next.fontFamily !== previous.fontFamily) override.fontFamily = next.fontFamily
      if (next.fontSize !== previous.fontSize) { override.fontSize = next.fontSize; override.placement ??= placementOf(next, format) }
    }
    if (Object.keys(override).length) design.overrides[previous.id] = override
  }
  design.extras = elements.filter((el) => !el.id.startsWith(`${design.instanceId}:`)).map((element) => ({ element: structuredClone(element), placement: placementOf(element, format) }))
  return composeDesign({ ...project, composition: { ...project.composition, design } })
}

export function referencedAssetIds(project: Project): string[] {
  return [...new Set([...(project.assetIds ?? []), ...project.composition.elements.flatMap(elementAssetIds),
    ...Object.values(project.composition.design?.overrides ?? {}).flatMap(({ replacement }) => replacement ? elementAssetIds(replacement) : []),
    ...Object.values(project.composition.design?.images ?? {}).map((image) => image.assetId),
    ...(project.composition.design?.extras ?? []).flatMap(({ element }) => elementAssetIds(element))])]
}

export function remapDesign(design: CoverDesign, assets: Map<string, string>, elementIds: Map<string, string>): CoverDesign {
  const copy = structuredClone(design), oldId = copy.instanceId
  copy.instanceId = crypto.randomUUID()
  copy.layerOrder = copy.layerOrder?.map((id) => id.startsWith(`${oldId}:`) ? id.replace(`${oldId}:`, `${copy.instanceId}:`) : elementIds.get(id) ?? id)
  for (const image of Object.values(copy.images)) image.assetId = assets.get(image.assetId) ?? image.assetId
  copy.overrides = Object.fromEntries(Object.entries(copy.overrides).map(([id, override]) => [id.replace(`${oldId}:`, `${copy.instanceId}:`), override]))
  for (const [id, override] of Object.entries(copy.overrides)) {
    if (override.replacement) {
      override.replacement.id = id
      override.replacement = remapElementAssets(override.replacement, assets)
    }
  }
  copy.extras = copy.extras.map(({ element, placement }) => ({ placement, element: remapElementAssets({ ...element, id: elementIds.get(element.id) ?? crypto.randomUUID() }, assets) }))
  return copy
}

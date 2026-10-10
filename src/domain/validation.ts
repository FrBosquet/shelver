import { colorLabels } from './colorLabels'
import { tableIcons } from './tableIcons'
import { SCHEMA_VERSION } from './types'
import type { Asset, CoverDesign, Element, Project } from './types'

export function supportedVersion(value: unknown): value is 1 | 2 { return value === 1 || value === SCHEMA_VERSION }

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function validShadow(value: unknown): boolean {
  return isRecord(value) && typeof value.color === 'string' && /^#[0-9a-f]{6}$/i.test(value.color)
    && finite(value.blur) && value.blur >= 0 && value.blur <= 100
    && finite(value.opacity) && value.opacity >= 0 && value.opacity <= 1
    && ['offsetX', 'offsetY'].every((key) => finite(value[key]) && Math.abs(value[key] as number) <= 200)
}

export function validProject(value: unknown): value is Project {
  if (!isRecord(value) || !supportedVersion(value.schemaVersion)) return false
  if (!['id', 'name', 'templateId', 'createdAt', 'updatedAt'].every((key) => typeof value[key] === 'string')) return false
  if (!value.id || !Number.isFinite(Date.parse(String(value.createdAt))) || !Number.isFinite(Date.parse(String(value.updatedAt)))) return false
  if (!['pc', 'switch', 'playstation', 'xbox', 'custom'].includes(String(value.platform))) return false
  if (!Number.isInteger(value.templateVersion) || !isRecord(value.composition)) return false
  if (value.assetIds !== undefined && (!Array.isArray(value.assetIds) || !value.assetIds.every((id) => typeof id === 'string' && id.length > 0))) return false
  const composition = value.composition
  if (typeof composition.background !== 'string' || !isRecord(composition.format) || !Array.isArray(composition.elements)) return false
  const format = composition.format
  if (format.printSize !== undefined && (!isRecord(format.printSize) || ![format.printSize.width, format.printSize.height].every((size) => typeof size === 'number' && Number.isFinite(size) && size > 0 && size <= 1000))) return false
  if (composition.design !== undefined && (value.schemaVersion !== 2 || !validDesign(composition.design))) return false
  if (!['px', 'mm'].includes(String(format.unit))) return false
  if (![format.width, format.height].every((size) => typeof size === 'number' && Number.isFinite(size) && size > 0 && size <= 16000)) return false
  if (![format.bleed, format.safeMargin].every((size) => typeof size === 'number' && Number.isFinite(size) && size >= 0)) return false
  if (!Array.isArray(format.panels) || !format.panels.length || !format.panels.every((panel: unknown) => isRecord(panel)
    && ['back', 'spine', 'front'].includes(String(panel.id))
    && typeof panel.x === 'number' && Number.isFinite(panel.x)
    && typeof panel.width === 'number' && Number.isFinite(panel.width) && panel.width > 0)) return false
  const panels = format.panels
  if (composition.design && (format.unit !== 'px' || Number(format.width) * Number(format.height) > 64_000_000
    || panels.length !== 3 || !['back', 'spine', 'front'].every((id) => panels.filter((p) => p.id === id).length === 1)
    || panels.some((p) => p.x < 0 || p.x + p.width > Number(format.width)))) return false
  const ids = new Set<string>()
  return composition.elements.every((element: unknown) => {
    if (!validElement(element) || ids.has(element.id)) return false
    ids.add(element.id)
    return true
  })
}

function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) }
function validElement(element: unknown): element is Element {
  if (!isRecord(element) || typeof element.id !== 'string' || !element.id || typeof element.name !== 'string') return false
  if (!['x', 'y', 'width', 'height', 'scaleX', 'scaleY', 'rotation', 'opacity'].every((key) => finite(element[key]))) return false
  if (typeof element.visible !== 'boolean' || typeof element.locked !== 'boolean') return false
  if (element.blockId !== undefined && typeof element.blockId !== 'string') return false
  if (element.styleRef !== undefined && typeof element.styleRef !== 'string') return false
  if (element.fontRole !== undefined && !['heading', 'body', 'technical'].includes(String(element.fontRole))) return false
  if (element.typeMemory !== undefined && (!isRecord(element.typeMemory) || !Object.entries(element.typeMemory).every(([type, snapshot]) => ['text', 'image', 'shape', 'table', 'rating', 'qr'].includes(type) && isRecord(snapshot) && snapshot.type === type && snapshot.typeMemory === undefined && validElement(snapshot)))) return false
  if (element.type === 'text') return (element.verticalAlign === undefined || ['top', 'middle', 'bottom'].includes(String(element.verticalAlign))) && ['text', 'fontFamily', 'fill'].every((key) => typeof element[key] === 'string') && finite(element.fontSize) && element.fontSize > 0
    && (element.fontWeight === undefined || ['normal', 'bold'].includes(String(element.fontWeight)))
    && (element.textAlign === undefined || ['left', 'center', 'right', 'balanced'].includes(String(element.textAlign)))
    && (element.shadow === undefined || validShadow(element.shadow))
    && (element.charSpacing === undefined || finite(element.charSpacing) && element.charSpacing >= -200 && element.charSpacing <= 2000)
    && (element.lineHeight === undefined || finite(element.lineHeight) && element.lineHeight > 0 && element.lineHeight <= 10)
  if (element.type === 'image') return typeof element.assetId === 'string' && Boolean(element.assetId)
    && (element.filters === undefined || isRecord(element.filters)
      && ['brightness', 'contrast', 'saturation'].every((key) => element.filters && isRecord(element.filters) && (element.filters[key] === undefined || finite(element.filters[key]) && element.filters[key] >= -1 && element.filters[key] <= 1))
      && (element.filters.blur === undefined || finite(element.filters.blur) && element.filters.blur >= 0 && element.filters.blur <= 1)
      && (element.filters.backdropBlur === undefined || finite(element.filters.backdropBlur) && element.filters.backdropBlur >= 0 && element.filters.backdropBlur <= 100)
      && (element.filters.shadow === undefined || isRecord(element.filters.shadow)
        && typeof element.filters.shadow.color === 'string' && /^#[0-9a-f]{6}$/i.test(element.filters.shadow.color)
        && finite(element.filters.shadow.blur) && element.filters.shadow.blur >= 0 && element.filters.shadow.blur <= 100
        && finite(element.filters.shadow.opacity) && element.filters.shadow.opacity >= 0 && element.filters.shadow.opacity <= 1
        && ['offsetX', 'offsetY'].every((key) => isRecord(element.filters) && isRecord(element.filters.shadow) && finite(element.filters.shadow[key]) && Math.abs(element.filters.shadow[key]) <= 200))
      && ['grayscale', 'invert'].every((key) => element.filters && isRecord(element.filters) && (element.filters[key] === undefined || typeof element.filters[key] === 'boolean'))
      && (element.filters.tintRole === undefined || typeof element.filters.tintRole === 'string' && Object.hasOwn(colorLabels, element.filters.tintRole))
      && (element.filters.tint === undefined || typeof element.filters.tint === 'string' && /^#[0-9a-f]{6}$/i.test(element.filters.tint)))
    && (element.fit === undefined || ['cover', 'contain', 'repeat'].includes(String(element.fit)))
    && (element.imageScale === undefined || finite(element.imageScale) && element.imageScale > 0)
    && ['offsetX', 'offsetY'].every((key) => element[key] === undefined || finite(element[key]))
    && ['focalX', 'focalY'].every((key) => element[key] === undefined || finite(element[key]) && element[key] >= 0 && element[key] <= 1)
  if (element.type === 'qr') return typeof element.url === 'string' && element.url.length <= 2000
  if (element.type === 'rating') return ['3', '7', '12', '16', '18'].includes(String(element.rating))
  if (element.type === 'table') return (element.verticalAlign === undefined || ['top', 'middle', 'bottom'].includes(String(element.verticalAlign)))
    && (element.fontFamily === undefined || typeof element.fontFamily === 'string' && element.fontFamily.length > 0)
    && (element.textAlign === undefined || ['left', 'center', 'right', 'balanced'].includes(String(element.textAlign)))
    && (element.padding === undefined || finite(element.padding) && element.padding >= 0 && element.padding <= 1000) && (element.contentFormat === undefined || element.contentFormat === 'markdown') && Array.isArray(element.cells) && element.cells.length > 0 && element.cells.length <= 20
    && element.cells.every((row) => Array.isArray(row) && row.length > 0 && row.length <= 10 && row.length === (element.cells as unknown[][])[0].length && row.every((cell) => typeof cell === 'string'))
    && (element.icons === undefined || Array.isArray(element.icons) && element.icons.length === element.cells.length && element.icons.every((row, r) => Array.isArray(row) && row.length === (element.cells as unknown[][])[r].length && row.every((icon) => icon === null || tableIcons.some((entry) => entry.id === icon))))
    && typeof element.fill === 'string' && typeof element.textColor === 'string' && finite(element.fontSize) && element.fontSize > 0
  return element.type === 'shape' && typeof element.fill === 'string' && (element.gradientTo === undefined || typeof element.gradientTo === 'string')
    && (element.fillMode === undefined || ['solid', 'linear', 'radial'].includes(String(element.fillMode)))
    && (element.gradientToOpacity === undefined || finite(element.gradientToOpacity) && element.gradientToOpacity >= 0 && element.gradientToOpacity <= 1)
}

function validPlacement(value: unknown): boolean {
  return isRecord(value) && ['back', 'spine', 'front'].includes(String(value.panel))
    && ['referenceWidth', 'referenceHeight', 'referenceX', 'x', 'y', 'width', 'height', 'scaleX', 'scaleY', 'rotation'].every((key) => finite(value[key]))
    && Number(value.referenceWidth) > 0 && Number(value.referenceHeight) > 0
}

export function validDesign(value: unknown): value is CoverDesign {
  if (!isRecord(value) || value.version !== 1 || value.templateId !== 'steam-editorial-v1' || typeof value.templateName !== 'string' || typeof value.instanceId !== 'string' || !value.instanceId) return false
  if (!isRecord(value.styles) || !isRecord(value.styles.colors) || !isRecord(value.styles.fonts) || !isRecord(value.styles.text)) return false
  const { colors, fonts, text } = value.styles
  const colorRoles = ['brand', 'spine', 'onSpine', 'technical', 'onTechnical', 'artwork', 'onArtwork', 'rating'], fontRoles = ['heading', 'body', 'technical']
  if (!colorRoles.every((key) => ((key === 'spine' || key === 'onSpine') && colors[key] === undefined) || typeof colors[key] === 'string' && /^#[0-9a-f]{6}$/i.test(colors[key]))) return false
  if (!fontRoles.every((key) => typeof fonts[key] === 'string' && Boolean(fonts[key]))) return false
  if (!['title', 'headline', 'body', 'caption', 'quote', 'technical', 'label', 'legal'].every((key) => {
    const style = text[key]
    return isRecord(style) && fontRoles.includes(String(style.font)) && colorRoles.includes(String(style.color)) && finite(style.size) && style.size > 0 && style.size <= 200
      && ['normal', 'bold'].includes(String(style.weight)) && ['left', 'center', 'right'].includes(String(style.align))
  })) return false
  const shared = value.shared
  if (!isRecord(shared) || !['title', 'publisher', 'rating', 'legal', 'headline', 'synopsis', 'quote', 'attribution'].every((key) => typeof shared[key] === 'string')) return false
  if (!Array.isArray(value.blocks) || value.blocks.length > 100) return false
  const ids = new Set<string>()
  if (!value.blocks.every((block) => {
    if (!isRecord(block) || typeof block.id !== 'string' || !block.id || ids.has(block.id) || typeof block.name !== 'string') return false
    ids.add(block.id)
    if (!['artwork', 'platform', 'title', 'intro', 'gallery', 'review', 'requirements', 'features', 'rating', 'publisher', 'barcode', 'qr', 'spine'].includes(String(block.kind)) || !['back', 'spine', 'front'].includes(String(block.panel)) || typeof block.hidden !== 'boolean') return false
    if (!['x', 'y', 'width', 'height'].every((key) => finite(block[key]) && block[key] >= 0 && block[key] <= 1) || Number(block.width) <= 0 || Number(block.height) <= 0) return false
    if (!Array.isArray(block.items) || block.items.length > 64) return false
    const itemIds = new Set<string>()
    return block.items.every((item) => {
      if (!isRecord(item) || !['id', 'title', 'text', 'detail'].every((key) => typeof item[key] === 'string') || !item.id || itemIds.has(String(item.id))) return false
      itemIds.add(String(item.id)); return true
    })
  })) return false
  if (!isRecord(value.images) || !Object.values(value.images).every((image) => isRecord(image) && typeof image.assetId === 'string' && Boolean(image.assetId) && ['cover', 'contain'].includes(String(image.fit)) && ['focalX', 'focalY'].every((key) => finite(image[key]) && image[key] >= 0 && image[key] <= 1))) return false
  if (!isRecord(value.overrides) || !Object.values(value.overrides).every((override) => isRecord(override)
    && (override.fontRole === undefined || ['heading', 'body', 'technical'].includes(String(override.fontRole)))
    && (override.replacement === undefined || validElement(override.replacement))
    && (override.placement === undefined || validPlacement(override.placement))
    && ['name', 'text', 'fill', 'fontFamily'].every((key) => override[key] === undefined || typeof override[key] === 'string')
    && (override.fontSize === undefined || finite(override.fontSize) && override.fontSize > 0)
    && (override.shadow === undefined || override.shadow === null || validShadow(override.shadow))
    && (override.lineHeight === undefined || finite(override.lineHeight) && override.lineHeight > 0 && override.lineHeight <= 10)
    && (override.charSpacing === undefined || finite(override.charSpacing) && override.charSpacing >= -200 && override.charSpacing <= 2000)
    && (override.opacity === undefined || finite(override.opacity) && override.opacity >= 0 && override.opacity <= 1)
    && (override.hidden === undefined || typeof override.hidden === 'boolean'))) return false
  const extraIds = new Set<string>()
  if (value.layerOrder !== undefined && (!Array.isArray(value.layerOrder) || !value.layerOrder.every((id) => typeof id === 'string' && Boolean(id)) || new Set(value.layerOrder).size !== value.layerOrder.length)) return false
  return Array.isArray(value.extras) && value.extras.every((extra) => {
    if (!isRecord(extra) || !validElement(extra.element) || !validPlacement(extra.placement) || extraIds.has(extra.element.id) || extra.element.id.startsWith(`${value.instanceId}:`)) return false
    extraIds.add(extra.element.id); return true
  })
}

export function validAsset(value: unknown): value is Asset {
  return isRecord(value) && typeof value.id === 'string' && Boolean(value.id) && typeof value.name === 'string'
    && typeof value.mimeType === 'string' && value.blob instanceof Blob
    && typeof value.width === 'number' && value.width > 0 && Number.isFinite(value.width)
    && typeof value.height === 'number' && value.height > 0 && Number.isFinite(value.height)
}

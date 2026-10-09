import { SCHEMA_VERSION } from './types'
import type { Asset, Project } from './types'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function validProject(value: unknown): value is Project {
  if (!isRecord(value) || value.schemaVersion !== SCHEMA_VERSION) return false
  if (!['id', 'name', 'templateId', 'createdAt', 'updatedAt'].every((key) => typeof value[key] === 'string')) return false
  if (!value.id || !Number.isFinite(Date.parse(String(value.createdAt))) || !Number.isFinite(Date.parse(String(value.updatedAt)))) return false
  if (!['pc', 'switch', 'playstation', 'xbox', 'custom'].includes(String(value.platform))) return false
  if (!Number.isInteger(value.templateVersion) || !isRecord(value.composition)) return false
  const composition = value.composition
  if (typeof composition.background !== 'string' || !isRecord(composition.format) || !Array.isArray(composition.elements)) return false
  const format = composition.format
  if (!['px', 'mm'].includes(String(format.unit))) return false
  if (![format.width, format.height].every((size) => typeof size === 'number' && Number.isFinite(size) && size > 0 && size <= 16000)) return false
  if (![format.bleed, format.safeMargin].every((size) => typeof size === 'number' && Number.isFinite(size) && size >= 0)) return false
  if (!Array.isArray(format.panels) || !format.panels.length || !format.panels.every((panel: unknown) => isRecord(panel)
    && ['back', 'spine', 'front'].includes(String(panel.id))
    && typeof panel.x === 'number' && Number.isFinite(panel.x)
    && typeof panel.width === 'number' && Number.isFinite(panel.width) && panel.width > 0)) return false
  const ids = new Set<string>()
  return composition.elements.every((element: unknown) => {
    if (!isRecord(element) || typeof element.id !== 'string' || !element.id || ids.has(element.id) || typeof element.name !== 'string') return false
    ids.add(element.id)
    if (!['x', 'y', 'width', 'height', 'scaleX', 'scaleY', 'rotation', 'opacity'].every((key) => typeof element[key] === 'number' && Number.isFinite(element[key]))) return false
    if (typeof element.visible !== 'boolean' || typeof element.locked !== 'boolean') return false
    if (element.type === 'text') return ['text', 'fontFamily', 'fill'].every((key) => typeof element[key] === 'string') && typeof element.fontSize === 'number' && Number.isFinite(element.fontSize) && element.fontSize > 0
    if (element.type === 'image') return typeof element.assetId === 'string' && Boolean(element.assetId)
    return element.type === 'shape' && typeof element.fill === 'string'
  })
}

export function validAsset(value: unknown): value is Asset {
  return isRecord(value) && typeof value.id === 'string' && Boolean(value.id) && typeof value.name === 'string'
    && typeof value.mimeType === 'string' && value.blob instanceof Blob
    && typeof value.width === 'number' && value.width > 0 && Number.isFinite(value.width)
    && typeof value.height === 'number' && value.height > 0 && Number.isFinite(value.height)
}

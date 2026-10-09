export const SCHEMA_VERSION = 1 as const

export type Platform = 'pc' | 'switch' | 'playstation' | 'xbox' | 'custom'
export type Panel = { id: 'back' | 'spine' | 'front'; x: number; width: number }
export type Format = {
  unit: 'px' | 'mm'
  width: number
  height: number
  panels: Panel[]
  bleed: number
  safeMargin: number
}

type BaseElement = {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
  scaleX: number
  scaleY: number
  rotation: number
  opacity: number
  visible: boolean
  locked: boolean
}
export type TextElement = BaseElement & {
  type: 'text'
  text: string
  fontFamily: string
  fontSize: number
  fill: string
}
export type ImageElement = BaseElement & { type: 'image'; assetId: string }
export type ShapeElement = BaseElement & { type: 'shape'; fill: string }
export type Element = TextElement | ImageElement | ShapeElement

export type Template = {
  schemaVersion: typeof SCHEMA_VERSION
  id: string
  name: string
  version: number
  platform: Platform
  format: Format
  background: string
  elements: Element[]
}
export type Project = {
  schemaVersion: typeof SCHEMA_VERSION
  id: string
  name: string
  platform: Platform
  templateId: string
  templateVersion: number
  createdAt: string
  updatedAt: string
  composition: Pick<Template, 'format' | 'background' | 'elements'>
}
export type Asset = {
  id: string
  blob: Blob
  name: string
  mimeType: string
  width: number
  height: number
}

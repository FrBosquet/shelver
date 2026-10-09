import type { TableIconId } from './tableIcons'
export const SCHEMA_VERSION = 2 as const
export type SchemaVersion = 1 | typeof SCHEMA_VERSION

export type Platform = 'pc' | 'switch' | 'playstation' | 'xbox' | 'custom'
export type Panel = { id: 'back' | 'spine' | 'front'; x: number; width: number }
export type Format = {
  id?: string
  name?: string
  unit: 'px' | 'mm'
  width: number
  height: number
  panels: Panel[]
  bleed: number
  safeMargin: number
}

type BaseElement = {
  typeMemory?: Partial<Record<Element['type'], Element>>
  blockId?: string
  styleRef?: string
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
  fontRole?: FontRole
  text: string
  fontFamily: string
  fontSize: number
  fill: string
    fontWeight?: 'normal' | 'bold'
    textAlign?: 'left' | 'center' | 'right'
    lineHeight?: number
}
export type ImageShadow = { color: string; blur: number; offsetX: number; offsetY: number; opacity: number }
export type ImageFilters = { blur?: number; backdropBlur?: number; shadow?: ImageShadow; brightness?: number; contrast?: number; saturation?: number; grayscale?: boolean; invert?: boolean; tint?: string }
export type ImageElement = BaseElement & { type: 'image'; assetId: string; filters?: ImageFilters; fit?: 'cover' | 'contain' | 'repeat'; imageScale?: number; offsetX?: number; offsetY?: number; focalX?: number; focalY?: number }
export type ShapeElement = BaseElement & { type: 'shape'; fill: string; gradientTo?: string }
export type TableElement = BaseElement & { type: 'table'; verticalAlign?: 'top' | 'middle' | 'bottom'; fontRole?: FontRole; textAlign?: 'left' | 'center' | 'right'; fontFamily?: string; icons?: (TableIconId | null)[][]; padding?: number; contentFormat?: 'markdown'; cells: string[][]; fill: string; textColor: string; fontSize: number }
export type RatingElement = BaseElement & { type: 'rating'; rating: '3' | '7' | '12' | '16' | '18' }
export type QrElement = BaseElement & { type: 'qr'; url: string }
export type Element = QrElement | TextElement | ImageElement | ShapeElement | TableElement | RatingElement

export type Template = {
  schemaVersion: SchemaVersion
  id: string
  name: string
  version: number
  platform: Platform
  format: Format
  background: string
  elements: Element[]
}
export type Project = {
  assetIds?: string[]
  schemaVersion: SchemaVersion
  id: string
  name: string
  platform: Platform
  templateId: string
  templateVersion: number
  createdAt: string
  updatedAt: string
  composition: Pick<Template, 'format' | 'background' | 'elements'> & { design?: CoverDesign }
}
export type Asset = {
  id: string
  blob: Blob
  name: string
  mimeType: string
  width: number
  height: number
}

export type PackageAsset = Omit<Asset, 'blob'> & { path: string; size: number; sha256: string }
export type ProjectPackage = {
  type: 'shelver-project'
  schemaVersion: SchemaVersion
  project: Project
  assets: PackageAsset[]
}

export type ColorRole = 'brand' | 'spine' | 'onSpine' | 'technical' | 'onTechnical' | 'artwork' | 'onArtwork' | 'rating'
export type FontRole = 'heading' | 'body' | 'technical'
export type TextRole = 'title' | 'headline' | 'body' | 'caption' | 'quote' | 'technical' | 'label' | 'legal'
export type TextStyle = { font: FontRole; color: ColorRole; size: number; weight: 'normal' | 'bold'; align: 'left' | 'center' | 'right' }
export type StyleSheet = { colors: Record<ColorRole, string>; fonts: Record<FontRole, string>; text: Record<TextRole, TextStyle> }
export type BlockKind = 'artwork' | 'platform' | 'title' | 'intro' | 'gallery' | 'review' | 'requirements' | 'features' | 'rating' | 'publisher' | 'barcode' | 'qr' | 'spine'
export type BlockItem = { id: string; title: string; text: string; detail: string }
export type DesignBlock = {
  id: string; name: string; kind: BlockKind; panel: Panel['id']
  x: number; y: number; width: number; height: number; hidden: boolean
  items: BlockItem[]
}
export type Placement = {
  panel: Panel['id']; referenceWidth: number; referenceHeight: number; referenceX: number
  x: number; y: number; width: number; height: number; scaleX: number; scaleY: number; rotation: number
}
export type ElementOverride = { fontRole?: FontRole; replacement?: Element; placement?: Placement; text?: string; fill?: string; fontFamily?: string; fontSize?: number; hidden?: boolean }
export type CoverDesign = {
  version: 1; instanceId: string; templateId: 'steam-editorial-v1'; templateName: string
  styles: StyleSheet
  shared: { title: string; publisher: string; rating: string; legal: string; headline: string; synopsis: string; quote: string; attribution: string }
  blocks: DesignBlock[]
  images: Record<string, { assetId: string; fit: 'cover' | 'contain'; focalX: number; focalY: number }>
  overrides: Record<string, ElementOverride>
  extras: { element: Element; placement: Placement }[]
}

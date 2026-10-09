import { FabricImage, Rect, Textbox } from 'fabric'
import type { FabricObject } from 'fabric'
import type { Asset, Element } from '../domain/types'

export async function renderElement(element: Element, assets: Record<string, Asset>, signal: AbortSignal): Promise<FabricObject> {
  let object: FabricObject
  if (element.type === 'text') {
    object = new Textbox(element.text, { fontFamily: element.fontFamily, fontSize: element.fontSize, fill: element.fill })
  } else if (element.type === 'shape') {
    object = new Rect({ fill: element.fill })
  } else {
    const asset = assets[element.assetId]
    if (!asset) throw new Error(`Missing artwork: ${element.name}`)
    const url = URL.createObjectURL(asset.blob)
    try {
      object = await FabricImage.fromURL(url, { signal })
    } finally {
      URL.revokeObjectURL(url)
    }
  }
  object.set({
    originX: 'left', originY: 'top',
    left: element.x, top: element.y, width: element.width,
    ...(element.type !== 'text' ? { height: element.height } : {}),
    scaleX: element.scaleX, scaleY: element.scaleY, angle: element.rotation,
    opacity: element.opacity, visible: element.visible,
    selectable: !element.locked, evented: !element.locked,
    cornerColor: '#c2e3b5', borderColor: '#c2e3b5', cornerStyle: 'circle', transparentCorners: false,
  })
  return object
}

export function readElement(object: FabricObject, original: Element): Element {
  const base = {
    ...original, x: object.left, y: object.top, width: object.width, height: object.height,
    scaleX: object.scaleX, scaleY: object.scaleY, rotation: object.angle,
    opacity: object.opacity, visible: object.visible,
  }
  if (original.type === 'text' && object instanceof Textbox) {
    return { ...base, type: 'text', text: object.text, fontFamily: object.fontFamily, fontSize: object.fontSize, fill: String(object.fill) }
  }
  return base
}

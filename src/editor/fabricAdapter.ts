import { FabricImage, Group, Rect, Textbox } from 'fabric'
import { pegiColor, pegiLayout } from '../domain/pegi'
import type { FabricObject } from 'fabric'
import type { Asset, Element } from '../domain/types'

export async function renderElement(element: Element, assets: Record<string, Asset>, signal: AbortSignal): Promise<FabricObject> {
  let object: FabricObject
  if (element.type === 'text') {
    object = new Textbox(element.text, { fontFamily: element.fontFamily, fontSize: element.fontSize, fill: element.fill })
  } else if (element.type === 'shape') {
    object = new Rect({ fill: element.fill })
  } else if (element.type === 'rating') {
    const badge = pegiLayout(element.width, element.height)
    const { left, top, width, height, border, inset, square } = badge
    object = new Group([
      new Rect({ originX: 'left', originY: 'top', width: element.width, height: element.height, fill: 'transparent', strokeWidth: 0 }),
      new Rect({ originX: 'left', originY: 'top', left, top, width, height, fill: '#000000', strokeWidth: 0 }),
      new Rect({ originX: 'left', originY: 'top', left: left + border, top: top + border, width: width - border * 2, height: height - border * 2, fill: '#ffffff', strokeWidth: 0 }),
      new Rect({ originX: 'left', originY: 'top', left: left + inset, top: top + inset, width: square, height: square, fill: pegiColor(element.rating), strokeWidth: 0 }),
      new Textbox(element.rating, { originX: 'left', originY: 'top', left: left + inset, top: top + inset - square * 0.025, width: square, fontSize: badge.numberSize, fontWeight: 'bold', fontFamily: 'Arial Narrow, Arial', fill: '#ffffff', textAlign: 'center', lineHeight: 1 }),
      new Textbox('TM', { originX: 'left', originY: 'top', left: left + width * 0.85, top: top + inset, width: width * 0.12, fontSize: width * 0.065, fontFamily: 'Arial', fill: '#ffffff', textAlign: 'center', lineHeight: 1 }),
      new Textbox('www.pegi.info', { originX: 'left', originY: 'top', left: left + inset, top: top + inset + square + width * 0.015, width: square, fontSize: badge.footerSize, fontFamily: 'Arial', fill: '#000000', textAlign: 'center', lineHeight: 1 }),
    ])
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

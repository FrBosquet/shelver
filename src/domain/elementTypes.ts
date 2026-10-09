import type { Element } from './types'

// Keep one flat snapshot per type; placement always follows the current element.
export function switchElementType(current: Element, fallback: Element): Element {
  const snapshot = structuredClone(current)
  delete snapshot.typeMemory
  const typeMemory = { ...structuredClone(current.typeMemory ?? {}), [current.type]: snapshot }
  const restored = typeMemory[fallback.type] ?? fallback
  return { ...structuredClone(restored), id: current.id, name: current.name, blockId: current.blockId,
    x: current.x, y: current.y, width: current.width, height: current.height,
    scaleX: current.scaleX, scaleY: current.scaleY, rotation: current.rotation,
    opacity: current.opacity, visible: current.visible, locked: current.locked, typeMemory }
}

export function elementAssetIds(element: Element): string[] {
  return [element, ...Object.values(element.typeMemory ?? {})].flatMap((value) => value.type === 'image' ? [value.assetId] : [])
}

export function remapElementAssets(element: Element, assets: Map<string, string>): Element {
  const copy = structuredClone(element)
  for (const value of [copy, ...Object.values(copy.typeMemory ?? {})]) {
    if (value.type === 'image') value.assetId = assets.get(value.assetId) ?? value.assetId
    value.id = copy.id
  }
  return copy
}

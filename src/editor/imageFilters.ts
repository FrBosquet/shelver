import type { ImageFilters, ImageShadow } from '../domain/types'

export function updateImageFilters(current: ImageFilters | undefined, update: Partial<ImageFilters> | null, shadowUpdate?: Partial<ImageShadow>): ImageFilters {
  if (!update) return {}
  const next = { ...current, ...update }
  if (shadowUpdate) next.shadow = { color: '#000000', opacity: 0.6, blur: 12, offsetX: 0, offsetY: 0, ...current?.shadow, ...shadowUpdate }
  return next
}

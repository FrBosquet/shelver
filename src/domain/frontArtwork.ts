import type { ImageElement, Project } from './types'

export function frontArtwork(project: Project): ImageElement | undefined {
  const { format, elements, design } = project.composition
  const front = format.panels.find((panel) => panel.id === 'front')
  if (!front) return
  const images = elements.filter((element): element is ImageElement => {
    if (element.type !== 'image' || !element.visible || element.opacity <= 0 || element.assetId.startsWith('builtin:')) return false
    const centerX = element.x + element.width * Math.abs(element.scaleX) / 2
    return centerX >= front.x && centerX <= front.x + front.width
  })
  const artwork = images.find((image) => design?.blocks.some((block) => block.id === image.blockId && block.kind === 'artwork' && block.panel === 'front'))
  return artwork ?? images.sort((a, b) => b.width * b.height * Math.abs(b.scaleX * b.scaleY) - a.width * a.height * Math.abs(a.scaleX * a.scaleY))[0]
}

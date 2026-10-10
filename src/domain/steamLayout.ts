import type { Element, Format, Placement } from './types'

// Reusable layout measured from the completed reference; no game content or assets.
const layout: [string, Placement['panel'], number, number, number, number, number][] = [
  ['features:table', 'back', 0.02500000, 0.79500000, 0.95000000, 0.07131944, 0],
  ['gallery:shot-1-image', 'back', 0.02566606, 0.37198758, 0.30083042, 0.10979670, 0],
  ['gallery:shot-1-caption', 'back', 0.02916004, 0.49053246, 0.30083333, 0.05760000, 0],
  ['gallery:shot-2-image', 'back', 0.35374341, 0.36813251, 0.30083042, 0.10979670, 0],
  ['gallery:shot-2-caption', 'back', 0.35374337, 0.49053246, 0.30083333, 0.05760000, 0],
  ['gallery:shot-3-image', 'back', 0.67832667, 0.36681891, 0.30083042, 0.10979670, 0],
  ['gallery:shot-3-caption', 'back', 0.67832670, 0.49053246, 0.30083333, 0.05760000, 0],
  ['review:quote', 'back', 0.11660797, 0.55490088, 0.78044745, 0.05331803, 0],
  ['review:attribution', 'back', 0.07042615, 0.61057555, 0.86000000, 0.01650000, 0],
  ['back-publisher:publisher', 'back', 0.18404241, 0.88161833, 0.29000001, 0.05250001, 0],
  ['back-publisher:legal', 'back', 0.18221132, 0.93123191, 0.38337299, 0.04725000, 0],
  ['intro:synopsis', 'back', 0.07007215, 0.15206389, 0.52377780, 0.21120000, 0],
  ['back-art:art', 'back', 0.00000000, 0.00000000, 1.00000000, 0.63500000, 0],
  ['platform:logo', 'front', 0.03999998, 0.01143642, 0.35000003, 0.05950000, 0],
  ['spine:platform-logo', 'spine', 0.79999977, 0.02000000, 2.89800030, 0.03726706, 90],
  ['spine:publisher', 'spine', 0.79999977, 0.79999998, 2.89800030, 0.04037270, 90],
  ['front-publisher:publisher', 'front', 0.58278404, 0.89999999, 0.38934995, 0.04282849, 0],
  ['technical-surface', 'back', 0.00000000, 0.61789356, 1.00000000, 0.38208183, 0],
  ['platform:surface', 'front', 0.00000000, 0.00000000, 0.75000000, 0.08500000, 0],
  ['intro:headline', 'back', 0.07000000, 0.03368638, 0.53000000, 0.11220000, 0],
  ['requirements:table', 'back', 0.02500000, 0.64500000, 0.95000000, 0.15000000, 0],
  ['qr:code', 'back', 0.75500000, 0.88156810, 0.22000000, 0.09500000, 0],
  ['front-title:title', 'front', 0.07786334, 0.21063978, 0.85713660, 0.15239369, 0],
]

export function applySteamLayout(element: Element, format: Format): Element {
  const key = element.id.split(':').slice(1).join(':')
  const aliases: Record<string, string> = {
    'front-title:logo': 'front-title:title',
    'back-publisher:logo': 'back-publisher:publisher',
    'front-publisher:logo': 'front-publisher:publisher',
    'spine:publisher-logo': 'spine:publisher',
  }
  const entry = layout.find(([id]) => id === (aliases[key] ?? key))
  if (!entry) return element
  const [, panelId, x, y, width, height, rotation] = entry
  const panel = format.panels.find((candidate) => candidate.id === panelId)!
  return { ...element, x: panel.x + x * panel.width, y: y * format.height,
    width: width * panel.width, height: height * format.height, scaleX: 1, scaleY: 1, rotation,
    ...(key === 'requirements:table' || key === 'features:table' ? { opacity: 0.85 } : {}),
  }
}

import type { CoverDesign, DesignBlock, Format, Project, StyleSheet } from './types'
import { SCHEMA_VERSION } from './types'
import { composeDesign } from './composition'

// Working geometries, deliberately independent of the visual template. Not print measurements.
export function workingFormat(faceWidth = 600, height = 960, spineWidth = 52): Format {
  return { id: 'custom-digital', name: 'Custom digital format', unit: 'px', width: faceWidth * 2 + spineWidth, height, bleed: 0, safeMargin: 24,
    panels: [{ id: 'back', x: 0, width: faceWidth }, { id: 'spine', x: faceWidth, width: spineWidth }, { id: 'front', x: faceWidth + spineWidth, width: faceWidth }] }
}
export const workingFormats: Format[] = [
  { ...workingFormat(), id: 'portrait-working', name: 'Portrait · working format' },
  { ...workingFormat(600, 800, 70), id: 'compact-working', name: 'Compact · working format' },
  { ...workingFormat(720, 800, 90), id: 'wide-working', name: 'Wide · working format' },
]

export const steamStyles: StyleSheet = {
  colors: { brand: '#102637', spine: '#ffdb35', onSpine: '#101719', technical: '#091820', onTechnical: '#f5f4e9', artwork: '#e6c56d', onArtwork: '#172129', rating: '#91b52b' },
  fonts: { heading: 'Georgia', body: 'Georgia', technical: 'Arial' },
  text: {
    title: { font: 'heading', color: 'onArtwork', size: 54, weight: 'bold', align: 'left' },
    headline: { font: 'heading', color: 'onArtwork', size: 27, weight: 'bold', align: 'left' },
    body: { font: 'body', color: 'onArtwork', size: 18, weight: 'normal', align: 'left' },
    caption: { font: 'body', color: 'onArtwork', size: 13, weight: 'bold', align: 'center' },
    quote: { font: 'heading', color: 'onArtwork', size: 20, weight: 'bold', align: 'center' },
    technical: { font: 'technical', color: 'onTechnical', size: 12, weight: 'normal', align: 'left' },
    label: { font: 'technical', color: 'onTechnical', size: 14, weight: 'bold', align: 'left' },
    legal: { font: 'technical', color: 'onTechnical', size: 10, weight: 'normal', align: 'left' },
  },
}

function block(id: string, name: string, kind: DesignBlock['kind'], panel: DesignBlock['panel'], x: number, y: number, width: number, height: number): DesignBlock {
  return { id, name, kind, panel, x, y, width, height, hidden: false, items: [] }
}

export function createSteamProject(format: Format = workingFormats[0]): Project {
  const design: CoverDesign = {
    version: 1, instanceId: crypto.randomUUID(), templateId: 'steam-editorial-v1', templateName: 'Steam · Editorial',
    styles: structuredClone(steamStyles),
    shared: {
      title: 'CHANTS OF\nSENNAAR', publisher: 'YOUR PUBLISHER', rating: '7',
      headline: 'OBSERVA. ESCUCHA.\nCOMPRENDE.\nHAZ QUE HABLEN.',
      synopsis: 'Una aventura de puzles y exploración ambientada en un mundo inspirado en el mito de la Torre de Babel.\n\nSustituye este texto por la historia de tu juego.',
      quote: '“UNA AVENTURA BRILLANTE Y ORIGINAL”', attribution: '— IGN',
      legal: '© Your studio. All rights reserved.\nReplace with your legal information.',
    },
    blocks: [
      block('back-art', 'Back artwork', 'artwork', 'back', 0, 0, 1, 0.635),
      block('front-art', 'Front artwork', 'artwork', 'front', 0, 0, 1, 1),
      block('platform', 'Steam header', 'platform', 'front', 0, 0, 1, 0.085),
      block('front-title', 'Game identity', 'title', 'front', 0.12, 0.13, 0.77, 0.24),
      block('intro', 'Headline & synopsis', 'intro', 'back', 0.07, 0.035, 0.53, 0.33),
      block('gallery', 'Screenshots & captions', 'gallery', 'back', 0.025, 0.385, 0.95, 0.18),
      block('review', 'Review quote', 'review', 'back', 0.07, 0.57, 0.86, 0.055),
      block('requirements', 'PC requirements', 'requirements', 'back', 0.025, 0.645, 0.95, 0.15),
      block('features', 'Features & languages', 'features', 'back', 0.025, 0.795, 0.95, 0.07),
      block('back-rating', 'Back rating', 'rating', 'back', 0.025, 0.87, 0.39, 0.105),
      block('back-publisher', 'Publisher & legal', 'publisher', 'back', 0.44, 0.87, 0.29, 0.105),
      block('qr', 'QR code', 'qr', 'back', 0.755, 0.875, 0.22, 0.095),
      block('front-rating', 'Front rating', 'rating', 'front', 0.035, 0.86, 0.12, 0.1),
      block('front-publisher', 'Front publisher', 'publisher', 'front', 0.72, 0.9, 0.25, 0.055),
      block('spine', 'Spine identity', 'spine', 'spine', 0, 0, 1, 1),
    ], images: {}, overrides: {}, extras: [],
  }
  design.blocks.find((b) => b.id === 'gallery')!.items = [
    { id: 'shot-1', title: 'EXPLORA UN MUNDO\nFASCINANTE Y ENIGMÁTICO', text: '', detail: '' },
    { id: 'shot-2', title: 'DESCIFRA IDIOMAS\nA TRAVÉS DE LA OBSERVACIÓN', text: '', detail: '' },
    { id: 'shot-3', title: 'CONECTA CULTURAS\nY DEVUELVE LA ARMONÍA', text: '', detail: '' },
  ]
  design.blocks.find((b) => b.id === 'requirements')!.items = [
    ['SO', 'Windows 10 (64 bits)', 'Windows 10/11 (64 bits)'],
    ['Procesador', 'Intel Core i3-2100 / AMD FX-6300', 'Intel Core i5-7600 / AMD Ryzen 5 2600'],
    ['Memoria', '4 GB de RAM', '8 GB de RAM'],
    ['Gráficos', 'NVIDIA GeForce GTX 660 / AMD Radeon HD 7870', 'NVIDIA GeForce GTX 1060 / AMD Radeon RX 580'],
    ['Almacenamiento', '4 GB de espacio disponible', '4 GB de espacio disponible'],
  ].map(([title, text, detail], index) => ({ id: `spec-${index}`, title, text, detail }))
  design.blocks.find((b) => b.id === 'features')!.items = [
    { id: 'clock', title: 'horas', text: '', detail: '' },
    { id: 'star', title: '%', text: '', detail: '' },
    { id: 'calendar', title: '01/26', text: '', detail: '' },
    { id: 'controller', title: 'PC', text: '', detail: '' },
  ]
  const timestamp = new Date().toISOString()
  const project: Project = { schemaVersion: SCHEMA_VERSION, id: crypto.randomUUID(), name: 'Steam cover', platform: 'pc', templateId: design.templateId, templateVersion: 1,
    createdAt: timestamp, updatedAt: timestamp, composition: { format: structuredClone(format), background: design.styles.colors.artwork, elements: [], design } }
  return composeDesign(project)
}

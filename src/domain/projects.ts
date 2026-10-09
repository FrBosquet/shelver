import { SCHEMA_VERSION } from './types'
import type { Project, Template, TextElement } from './types'

export function createText(text = 'Your game title'): TextElement {
  return {
    id: crypto.randomUUID(), name: 'Text', type: 'text', text,
    x: 670, y: 120, width: 380, height: 60,
    scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, visible: true, locked: false,
    fontFamily: 'Arial', fontSize: 48, fill: '#f3f0e8',
  }
}

// Digital working dimensions only. Physical case measurements need validation.
export const pcTemplate: Template = {
  schemaVersion: SCHEMA_VERSION,
  id: 'pc-generic-v1', name: 'PC / Steam cover', version: 1, platform: 'pc',
  format: {
    unit: 'px', width: 1200, height: 800, bleed: 0, safeMargin: 32,
    panels: [
      { id: 'back', x: 0, width: 570 },
      { id: 'spine', x: 570, width: 60 },
      { id: 'front', x: 630, width: 570 },
    ],
  },
  background: '#22332e',
  elements: [
    { ...createText('YOUR GAME\nSTARTS HERE'), id: 'starter-title', fontSize: 58, y: 210, width: 460 },
    { ...createText('A cover worth keeping.'), id: 'starter-subtitle', fontSize: 24, y: 390 },
    { ...createText('Tell the story.\n\nAdd artwork, screenshots, and a few words about the world inside.'),
      id: 'starter-description', x: 54, y: 90, width: 450, fontSize: 27 },
  ],
}

export function createProject(template: Template): Project {
  const timestamp = new Date().toISOString()
  return {
    schemaVersion: SCHEMA_VERSION, id: crypto.randomUUID(), name: 'Untitled cover',
    platform: template.platform, templateId: template.id, templateVersion: template.version,
    createdAt: timestamp, updatedAt: timestamp,
    composition: structuredClone({ format: template.format, background: template.background, elements: template.elements }),
  }
}

export function duplicateProject(project: Project): Project {
  const timestamp = new Date().toISOString()
  return { ...structuredClone(project), id: crypto.randomUUID(), name: `${project.name} copy`, createdAt: timestamp, updatedAt: timestamp }
}

import { describe, expect, it } from 'vitest'
import { createText } from './projects'
import { createSteamProject } from './steamTemplate'
import { captureDesignEdits, composeDesign, remapDesign, referencedAssetIds } from './composition'
import type { Element } from './types'
import { validProject } from './validation'
import { exportCoverProject, importCoverProject } from '../packages/coverProject'

describe('custom element types', () => {
  it('preserves editable tables, boxes and ratings through template composition and package export', async () => {
    const project = createSteamProject()
    const base = { ...createText(), x: 700, y: 200, width: 300, height: 150 }
    const extras: Element[] = [
      { ...base, id: 'box', type: 'shape', fill: '#c2e3b5' },
      { ...base, id: 'table', type: 'table', cells: [['CPU', 'Memory'], ['4 cores', '8 GB']], fill: '#ffffff', textColor: '#172129', fontSize: 18 },
      { ...base, id: 'rating', type: 'rating', rating: '16' },
    ]
    const edited = captureDesignEdits(project, [...project.composition.elements, ...extras])
    expect(validProject(edited)).toBe(true)
    expect(composeDesign(edited).composition.elements.slice(-3)).toEqual(edited.composition.elements.slice(-3))
    const restored = await importCoverProject(await exportCoverProject(edited, {}))
    expect(restored.project.composition.design!.extras.map(({ element }) => element)).toEqual(extras)
    expect(restored.project.composition.elements.slice(-3)).toEqual(edited.composition.elements.slice(-3))
  })

  it('replaces a spine title independently and preserves the image through recomposition and import', async () => {
    const project = createSteamProject()
    const title = project.composition.elements.find((element) => element.blockId === 'spine' && element.type === 'text' && element.id.endsWith(':title'))!
    expect(title).toBeDefined()
    const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/ZxkAAAAASUVORK5CYII='), (value) => value.charCodeAt(0))
    const asset = { id: 'spine-logo', name: 'logo.png', blob: new Blob([bytes], { type: 'image/png' }), mimeType: 'image/png', width: 1, height: 1 }
    const replacement: Element = { ...title, type: 'image', assetId: asset.id, fit: 'contain' }
    let edited = captureDesignEdits(project, project.composition.elements.map((element) => element.id === title.id ? replacement : element))
    expect(validProject(edited)).toBe(true)
    expect(edited.composition.elements.find((element) => element.id === title.id)).toMatchObject(replacement)
    expect(edited.composition.elements.filter((element) => element.blockId !== 'spine')).toEqual(project.composition.elements.filter((element) => element.blockId !== 'spine'))
    edited.composition.design!.shared.title = 'Another title'
    edited = composeDesign(edited)
    expect(edited.composition.elements.find((element) => element.id === title.id)?.type).toBe('image')
    expect(referencedAssetIds(edited)).toContain(asset.id)
    const restored = await importCoverProject(await exportCoverProject(edited, { [asset.id]: asset }))
    expect(composeDesign(restored.project).composition.elements.find((element) => element.id === title.id)).toMatchObject(replacement)
    const remapped = remapDesign(edited.composition.design!, new Map([[asset.id, 'new-logo']]), new Map())
    expect(Object.values(remapped.overrides)[0].replacement).toMatchObject({ type: 'image', assetId: 'new-logo' })
    expect(Object.values(remapped.overrides)[0].replacement!.id).toContain(remapped.instanceId)
    const table: Element = { ...replacement, type: 'table', cells: [['A', 'B']], fill: '#ffffff', textColor: '#172129', fontSize: 18 }
    edited = captureDesignEdits(edited, edited.composition.elements.map((element) => element.id === title.id ? table : element))
    const changed: Element = { ...table, cells: [['Edited', 'B']] }
    edited = captureDesignEdits(edited, edited.composition.elements.map((element) => element.id === title.id ? changed : element))
    expect(composeDesign(edited).composition.elements.find((element) => element.id === title.id)).toMatchObject(changed)
    delete edited.composition.design!.overrides[title.id]
    expect(composeDesign(edited).composition.elements.find((element) => element.id === title.id)?.type).toBe('text')
  })

  it('rejects malformed table grids and unsupported PEGI ages', () => {
    const project = createSteamProject()
    const base = createText()
    project.composition.elements.push({ ...base, type: 'table', cells: [['A'], ['B', 'C']], fill: '#ffffff', textColor: '#172129', fontSize: 18 })
    expect(validProject(project)).toBe(false)
    project.composition.elements.pop()
    project.composition.elements.push({ ...base, type: 'rating', rating: '99' } as unknown as Element)
    expect(validProject(project)).toBe(false)
  })
})

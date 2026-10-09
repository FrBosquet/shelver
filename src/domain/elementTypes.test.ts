import { describe, expect, it } from 'vitest'
import { createProject, createText, pcTemplate } from './projects'
import { elementAssetIds, remapElementAssets, switchElementType } from './elementTypes'
import type { Element } from './types'
import { validProject } from './validation'
import { captureDesignEdits, composeDesign } from './composition'
import { createSteamProject } from './steamTemplate'
import { exportCoverProject, importCoverProject } from '../packages/coverProject'

const text = { ...createText('Original title'), fontFamily: 'Georgia', fontSize: 32, fill: '#aabbcc' }
const image: Element = { ...text, type: 'image', assetId: 'logo', fit: 'contain' }

describe('element type memory', () => {
  it('restores the latest content and style independently for each type while keeping current placement', () => {
    let current = switchElementType(text, image)
    current = { ...current, x: 900, rotation: 90 }
    current = switchElementType(current, createText('New text'))
    expect(current).toMatchObject({ type: 'text', text: 'Original title', fontFamily: 'Georgia', fontSize: 32, fill: '#aabbcc', x: 900, rotation: 90 })
    if (current.type !== 'text') throw new Error('Expected restored text')
    current = { ...current, text: 'Edited title' }
    current = switchElementType(current, image)
    current = switchElementType(current, createText())
    expect(current).toMatchObject({ text: 'Edited title' })
    expect(Object.values(current.typeMemory!).every((snapshot) => snapshot.typeMemory === undefined)).toBe(true)
    expect(elementAssetIds(current)).toEqual(['logo'])
    expect(remapElementAssets(current, new Map([['logo', 'imported-logo']])).typeMemory!.image).toMatchObject({ assetId: 'imported-logo' })
  })

  it('retains all five types across repeated switches', () => {
    const variants: Element[] = [image, { ...text, type: 'shape', fill: '#123456' }, { ...text, type: 'table', cells: [['Saved cell']], textColor: '#000000' }, { ...text, type: 'rating', rating: '18' }]
    let current: Element = text
    for (const variant of variants) current = switchElementType(current, variant)
    for (const variant of [...variants, text]) {
      current = switchElementType(current, variant)
      expect(current.type).toBe(variant.type)
    }
    expect(current).toMatchObject({ text: 'Original title' })
    expect(Object.keys(current.typeMemory!)).toHaveLength(5)
  })

  it('preserves spine content and dormant image data in project packages', async () => {
    const project = createSteamProject()
    const spine = project.composition.elements.find((element) => element.blockId === 'spine' && element.type === 'text' && element.id.endsWith(':title'))!
    const replacement = switchElementType(spine, { ...image, id: spine.id })
    let edited = captureDesignEdits(project, project.composition.elements.map((element) => element.id === spine.id ? replacement : element))
    const restoredText = switchElementType(replacement, text)
    edited = captureDesignEdits(edited, edited.composition.elements.map((element) => element.id === spine.id ? restoredText : element))
    const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/ZxkAAAAASUVORK5CYII='), (value) => value.charCodeAt(0))
    const asset = { id: 'logo', name: 'logo.png', blob: new Blob([bytes], { type: 'image/png' }), mimeType: 'image/png', width: 1, height: 1 }
    expect(validProject(edited)).toBe(true)
    const imported = await importCoverProject(await exportCoverProject(edited, { logo: asset }))
    const element = composeDesign(imported.project).composition.elements.find((element) => element.id === spine.id)!
    expect(element).toMatchObject({ type: 'text', text: spine.type === 'text' ? spine.text : '' })
    expect(switchElementType(element, image)).toMatchObject({ type: 'image', assetId: 'logo' })
  })

  it('rejects nested or mismatched type memory', () => {
    const project = createProject(pcTemplate)
    project.composition.elements = [{ ...text, typeMemory: { image: text } }]
    expect(validProject(project)).toBe(false)
    project.composition.elements = [{ ...text, typeMemory: { text: { ...text, typeMemory: { text } } } }]
    expect(validProject(project)).toBe(false)
  })
})

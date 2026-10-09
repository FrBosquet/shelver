import { afterEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { adaptElement, captureDesignEdits, composeDesign, placementOf, referencedAssetIds } from './composition'
import { createProject, pcTemplate } from './projects'
import { createSteamProject, workingFormats } from './steamTemplate'
import type { Asset, ImageElement, Project, RatingElement, TextElement } from './types'
import { validProject } from './validation'
import { WorkspaceStore } from '../storage/workspaceStore'
import { IndexedDbWorkspaceRepository } from '../storage/workspaceRepository'
import { exportCoverProject, importCoverProject } from '../packages/coverProject'

const repositories: IndexedDbWorkspaceRepository[] = []
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); for (const storage of repositories.splice(0)) storage.close() })
function setup() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const storage = new IndexedDbWorkspaceRepository('steam-test', new IDBFactory())
  repositories.push(storage)
  return { storage, store: new WorkspaceStore(storage) }
}
function text(project: Project, suffix: string) { return project.composition.elements.find((el) => el.id.endsWith(suffix))! as TextElement }
function artwork(): Asset {
  const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/ZxkAAAAASUVORK5CYII='), (value) => value.charCodeAt(0))
  return { id: 'art', name: 'art.png', blob: new Blob([bytes], { type: 'image/png' }), mimeType: 'image/png', width: 1, height: 1 }
}

describe('Steam composition', () => {
  it.each(workingFormats)('makes the front gradient editable at two fifths of the front width in $id', (format) => {
    const project = createSteamProject(format)
    const gradient = project.composition.elements.find((element) => element.id.endsWith(':platform:surface'))!
    const front = format.panels.find((panel) => panel.id === 'front')!
    expect(gradient).toMatchObject({ type: 'shape', x: front.x, width: front.width * 0.4, locked: false })
    const resized = { ...gradient, scaleX: 1.5, scaleY: 2, x: gradient.x + 20 }
    const saved = captureDesignEdits(project, project.composition.elements.map((element) => element.id === gradient.id ? resized : element))
    expect(composeDesign(saved).composition.elements.find((element) => element.id === gradient.id)).toMatchObject(resized)
  })

  it('preserves SVG filter edits through recomposition and rejects invalid filter settings', () => {
    const project = createSteamProject()
    const original = project.composition.elements.find((element) => element.type === 'image')! as ImageElement
    const filters = { brightness: 0.25, contrast: -0.1, saturation: 0.4, grayscale: true, invert: true, tint: '#123456' }
    const edited = captureDesignEdits(project, project.composition.elements.map((element) => element.id === original.id ? { ...original, filters } : element))
    const recomposed = composeDesign(edited)
    expect((recomposed.composition.elements.find((element) => element.id === original.id) as ImageElement).filters).toEqual(filters)
    expect(validProject(recomposed)).toBe(true)
    const invalid = structuredClone(recomposed)
    ;(invalid.composition.elements.find((element) => element.id === original.id) as ImageElement).filters = { brightness: 2 }
    expect(validProject(invalid)).toBe(false)
    for (const filters of [{ blur: -0.1 }, { blur: 2 }, { backdropBlur: 101 }, { shadow: { color: '#000000', opacity: 2, blur: 10, offsetX: 0, offsetY: 0 } }]) {
      ;(invalid.composition.elements.find((element) => element.id === original.id) as ImageElement).filters = filters
      expect(validProject(invalid)).toBe(false)
    }
  })

  it('preserves image fit, scale and offsets through recomposition and validates saved projects', () => {
    const project = createSteamProject()
    const original = project.composition.elements.find((element) => element.type === 'image')! as ImageElement
    expect(original).toBeDefined()
    const edited: ImageElement = { ...original, fit: 'repeat', imageScale: 0.75, offsetX: -24, offsetY: 32, x: original.x + 15 }
    const saved = captureDesignEdits(project, project.composition.elements.map((element) => element.id === original.id ? edited : element))
    const regenerated = composeDesign(saved)
    expect(regenerated.composition.elements.find((element) => element.id === original.id)).toMatchObject({ fit: 'repeat', imageScale: 0.75, offsetX: -24, offsetY: 32, x: edited.x })
    expect(validProject(regenerated)).toBe(true)
    const invalid = structuredClone(regenerated)
    const image = invalid.composition.elements.find((element) => element.id === original.id)! as ImageElement
    image.imageScale = 0
    expect(validProject(invalid)).toBe(false)
  })

  it('keeps a template text converted to an image across recomposition and restores its shared content', () => {
    let project = createSteamProject()
    const original = text(project, 'shot-1-caption')
    const replacement: ImageElement = { ...original, type: 'image', assetId: 'art', fit: 'contain' }
    project = captureDesignEdits(project, project.composition.elements.map((element) => element.id === original.id ? replacement : element))
    project.composition.design!.blocks.find((block) => block.id === original.blockId)!.items[0].title = 'Updated caption'
    const replaced = composeDesign(project).composition.elements.find((element) => element.id === original.id)!
    expect(replaced.type).toBe('image')
    expect((replaced as ImageElement).assetId).toBe('art')
    expect(replaced.blockId).toBe(original.blockId)
    expect(replaced.x).toBeCloseTo(original.x)
    expect(replaced.y).toBeCloseTo(original.y)
    delete project.composition.design!.overrides[original.id]
    const restored = composeDesign(project).composition.elements.find((element) => element.id === original.id)! as TextElement
    expect(restored.type).toBe('text')
    expect(restored.text).toBe('Updated caption')
  })

  it('preserves canvas placement edits while rating content continues to follow the block', () => {
    let project = createSteamProject()
    const rating = project.composition.elements.find((element) => element.blockId === 'back-rating' && element.type === 'rating' && element.rating === '7')!
    expect(rating).toBeDefined()
    const edited = structuredClone(project.composition.elements)
    const moved = edited.find((element) => element.id === rating.id)!
    moved.x += 20
    moved.y += 15
    moved.scaleX = 1.2
    moved.scaleY = 1.2
    moved.rotation = 10
    project = captureDesignEdits(project, edited)
    project.composition.design!.shared.rating = '18'
    const updated = composeDesign(project).composition.elements.find((element) => element.id === rating.id)! as RatingElement
    expect(updated.rating).toBe('18')
    expect(updated.x).toBeCloseTo(moved.x)
    expect(updated.y).toBeCloseTo(moved.y)
    expect(updated.scaleX).toBeCloseTo(1.2)
    expect(updated.scaleY).toBeCloseTo(1.2)
    expect(updated.rotation).toBe(10)
    expect(project.composition.design!.overrides[rating.id].text).toBeUndefined()
  })

  it('creates editable semantic blocks with referenced styles and bundled Steam logos', () => {
    const project = createSteamProject()
    expect(validProject(project)).toBe(true)
    expect(project.composition.design!.blocks.map((b) => b.kind)).toEqual(expect.arrayContaining(['gallery', 'requirements', 'features', 'rating', 'publisher', 'spine']))
    expect(project.composition.elements.filter((el) => el.id.endsWith('-caption')).every((el) => el.styleRef === 'caption')).toBe(true)
    expect(referencedAssetIds(project)).toEqual(['builtin:default-image:1', 'builtin:steam-logo-white:1', 'builtin:steam-logo-black:1'])
    expect(composeDesign(project)).toEqual(project)
  })

  it('propagates shared styles while preserving individual overrides and reset restores inheritance', () => {
    let project = createSteamProject()
    const id = text(project, 'shot-1-caption').id
    const edited = structuredClone(project.composition.elements)
    const caption = edited.find((el) => el.id === id)! as TextElement
    caption.fill = '#ee0044'; caption.text = 'My caption'
    project = captureDesignEdits(project, edited)
    project.composition.design!.styles.colors.onArtwork = '#0044ee'
    project.composition.design!.styles.fonts.body = 'Verdana'
    project = composeDesign(project)
    expect(text(project, 'shot-1-caption')).toMatchObject({ text: 'My caption', fill: '#ee0044', fontFamily: 'Verdana' })
    expect(text(project, 'shot-2-caption')).toMatchObject({ fill: '#0044ee', fontFamily: 'Verdana' })
    delete project.composition.design!.overrides[id]
    expect(text(composeDesign(project), 'shot-1-caption')).toMatchObject({ fill: '#0044ee', fontFamily: 'Verdana' })
  })

  it('shares title, publisher and rating data across panels', () => {
    const project = createSteamProject(), design = project.composition.design!
    Object.assign(design.shared, { title: 'MY GAME', publisher: 'MY STUDIO', rating: '12' })
    const composed = composeDesign(project)
    expect(text(composed, 'front-title:title').text).toBe('MY GAME')
    expect(text(composed, 'spine:title').text).toBe('MY GAME')
    expect(text(composed, 'front-publisher:publisher').text).toBe('MY STUDIO')
    expect(text(composed, 'back-publisher:publisher').text).toBe('MY STUDIO')
    expect(composed.composition.elements.find((el) => el.id.endsWith('front-rating:rating'))).toMatchObject({ type: 'rating', rating: '12' })
    expect(composed.composition.elements.find((el) => el.id.endsWith('back-rating:rating'))).toMatchObject({ type: 'rating', rating: '12' })
  })

  it('updates both unified badges when a template badge rating is edited', () => {
    const project = createSteamProject()
    const edited = structuredClone(project.composition.elements)
    const badge = edited.find((el) => el.blockId === 'front-rating' && el.type === 'rating')! as RatingElement
    badge.rating = '18'
    const updated = captureDesignEdits(project, edited)
    expect(updated.composition.design!.shared.rating).toBe('18')
    const badges = updated.composition.elements.filter((el) => el.type === 'rating')
    expect(badges).toHaveLength(2)
    expect(badges.every((el) => el.type === 'rating' && el.rating === '18')).toBe(true)
    expect(updated.composition.elements.some((el) => el.id.endsWith(':rating-number') || el.id.endsWith(':rating-fill'))).toBe(false)
  })

  it('keeps badges stable without an extra white frame when descriptors are removed', () => {
    for (const format of workingFormats) {
      for (const uploaded of [false, true]) {
        const project = createSteamProject()
        project.composition.format = structuredClone(format)
        const design = project.composition.design!
        const block = design.blocks.find((b) => b.id === 'back-rating')!
        if (uploaded) design.images.ratingLogo = { assetId: 'badge', fit: 'contain', focalX: 0.5, focalY: 0.5 }
        const element = (suffix: string) => composeDesign(project).composition.elements.find((el) => el.id.endsWith(`back-rating:${suffix}`))!
        const badgeKey = 'rating'
        const originalBadge = element(badgeKey)
        expect(composeDesign(project).composition.elements.some((el) => el.blockId?.endsWith('rating') && el.id.endsWith(':frame'))).toBe(false)
        while (block.items.length) {
          block.items.pop()
          const badge = element(badgeKey)
          expect(badge).toMatchObject({ x: originalBadge.x, y: originalBadge.y, width: originalBadge.width, height: originalBadge.height })
          expect(composeDesign(project).composition.elements.some((el) => el.blockId?.endsWith('rating') && el.id.endsWith(':frame'))).toBe(false)
        }
      }
    }
  })

  it('recomposes saved rating dimensions when reopening an existing project', async () => {
    const { storage, store } = setup()
    const project = createSteamProject()
    project.composition.design!.blocks.find((b) => b.id === 'back-rating')!.items = []
    // Simulate dimensions cached by the old layout with a single stretched badge.
    const badge = project.composition.elements.find((el) => el.id.endsWith('back-rating:rating'))!
    badge.width = 217
    await storage.save([project], [])
    await store.load()
    const reopened = store.getSnapshot().projects[0]
    expect(reopened.composition.elements).toEqual(composeDesign(project).composition.elements)
    expect(reopened.composition.elements.find((el) => el.id === badge.id)!.width).toBeLessThan(badge.width)
  })

  it('adapts block internals and preserves manually moved text and extra images through format round trips', () => {
    let project = createSteamProject()
    const originalFormat = structuredClone(project.composition.format)
    const edited = structuredClone(project.composition.elements)
    const caption = edited.find((el) => el.id.endsWith('shot-1-caption'))! as TextElement
    caption.x += 20; caption.y -= 10; caption.text = 'Edited caption'
    const originalCaption = structuredClone(caption)
    const image: ImageElement = { id: 'extra', name: 'Extra artwork', type: 'image', assetId: 'art', x: 700, y: 600, width: 100, height: 200, scaleX: 0.5, scaleY: 0.5, rotation: 12, opacity: 1, visible: true, locked: false }
    project = captureDesignEdits(project, [...edited, image])
    project.composition.format = structuredClone(workingFormats[2]); project = composeDesign(project)
    expect(text(project, 'shot-1-caption').text).toBe('Edited caption')
    expect(text(project, 'shot-1-caption').x).toBeCloseTo(originalCaption.x * 1.2)
    expect(text(project, 'shot-1-caption').fontSize).toBeCloseTo(13 * 800 / 960)
    const adaptedImage = project.composition.elements.find((el) => el.id === 'extra')!
    expect(adaptedImage.scaleX).toBe(adaptedImage.scaleY)
    project.composition.format = originalFormat; project = composeDesign(project)
    expect(text(project, 'shot-1-caption')).toMatchObject({ x: originalCaption.x, y: originalCaption.y, text: originalCaption.text })
    expect(project.composition.elements.find((el) => el.id === 'extra')).toEqual(image)
  })

  it('keeps removed elements hidden and supports multi-row screenshot galleries', () => {
    let project = createSteamProject()
    const removed = text(project, 'shot-1-caption')
    project = captureDesignEdits(project, project.composition.elements.filter((el) => el.id !== removed.id))
    const gallery = project.composition.design!.blocks.find((b) => b.kind === 'gallery')!
    gallery.items.push({ id: 'shot-4', title: 'Fourth caption', text: '', detail: '' })
    project = composeDesign(project)
    expect(text(project, 'shot-1-caption').visible).toBe(false)
    expect(text(project, 'shot-4-caption').y).toBeGreaterThan(text(project, 'shot-2-caption').y)
  })

  it('persists design edits and format changes, supports undo/redo, and duplicates styles independently', async () => {
    const { storage, store } = setup(); await store.load()
    const id = store.createSteam()!, original = structuredClone(store.getSnapshot().projects[0].composition)
    const design = structuredClone(original.design!)
    design.styles.colors.spine = '#123456'; design.shared.title = 'Saved title'
    store.updateDesign(id, design)
    store.changeFormat(id, workingFormats[1])
    store.undo(id)
    expect(store.getSnapshot().projects[0].composition.format).toEqual(original.format)
    expect(store.getSnapshot().projects[0].composition.design!.shared.title).toBe('Saved title')
    store.undo(id); expect(store.getSnapshot().projects[0].composition).toEqual(original)
    store.redo(id); store.redo(id); await store.flush()
    const reopened = new WorkspaceStore(storage); await reopened.load()
    expect(reopened.getSnapshot().projects[0].composition.design!.styles.colors.spine).toBe('#123456')
    expect(reopened.getSnapshot().projects[0].composition.format).toEqual(workingFormats[1])
    reopened.duplicate(id)
    const copy = reopened.getSnapshot().projects.find((p) => p.id !== id)!
    const copied = structuredClone(copy.composition.design!); copied.styles.colors.spine = '#654321'
    reopened.updateDesign(copy.id, copied)
    expect(reopened.getSnapshot().projects.find((p) => p.id === id)!.composition.design!.styles.colors.spine).toBe('#123456')
    await reopened.flush()
  })

  it('packages design image dependencies even in hidden blocks and remaps shared assets and override references on import', async () => {
    const project = createSteamProject(), asset = artwork(), design = project.composition.design!
    design.images.gameLogo = { assetId: asset.id, fit: 'contain', focalX: 0.5, focalY: 0.5 }
    design.blocks.find((b) => b.id === 'front-title')!.hidden = true
    const caption = text(project, 'shot-1-caption')
    design.overrides[caption.id] = { fill: '#aa0000' }
    const composed = composeDesign(project)
    const imported = await importCoverProject(await exportCoverProject(composed, { [asset.id]: asset }))
    const { storage, store } = setup(); await store.load()
    const id = store.importProject(imported.project, imported.assets); await store.flush()
    const recovered = (await storage.load()).projects.find((p) => p.id === id)!
    expect(recovered.composition.design!.instanceId).not.toBe(design.instanceId)
    const newAssetId = recovered.composition.design!.images.gameLogo.assetId
    expect(newAssetId).not.toBe(asset.id)
    expect(recovered.composition.elements.filter((el) => el.type === 'image' && el.assetId !== 'builtin:default-image:1').map((el) => el.assetId)).toEqual(['builtin:steam-logo-white:1', 'builtin:steam-logo-black:1', newAssetId])
    expect(text(recovered, 'shot-1-caption').fill).toBe('#aa0000')
    expect(composeDesign(recovered)).toEqual(recovered)
  })

  it('loads and imports version 1 projects and rejects malformed design metadata', async () => {
    const legacy = createProject(pcTemplate); legacy.schemaVersion = 1
    const { storage, store } = setup(); await storage.save([legacy], []); await store.load()
    expect(store.getSnapshot().projects[0]).toEqual(legacy)
    const blob = await exportCoverProject(legacy, {}), files = unzipSync(new Uint8Array(await blob.arrayBuffer()))
    const manifest = JSON.parse(strFromU8(files['manifest.json'])); manifest.schemaVersion = 1
    files['manifest.json'] = strToU8(JSON.stringify(manifest))
    expect((await importCoverProject(new Blob([zipSync(files)]))).project).toEqual(legacy)
    const invalid = createSteamProject()
    Object.assign(invalid.composition.design!.styles.text.caption, { size: Number.NaN })
    expect(validProject(invalid)).toBe(false)
    expect(() => store.updateDesign(store.createSteam()!, invalid.composition.design!)).toThrow('invalid')
    await store.flush()
  })

  it('adapts free legacy artwork without distorting its proportions', () => {
    const image: ImageElement = { id: 'free', name: 'Free', type: 'image', assetId: 'art', x: 700, y: 200, width: 100, height: 200, scaleX: 0.7, scaleY: 0.7, rotation: 45, opacity: 1, visible: true, locked: false }
    const project = createSteamProject()
    const adapted = adaptElement(image, placementOf(image, project.composition.format), workingFormats[2])
    expect(adapted.scaleX).toBe(adapted.scaleY)
    expect(adapted.rotation).toBe(45)
  })
})

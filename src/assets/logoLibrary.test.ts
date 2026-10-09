import { afterEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { builtinAsset, builtinAssets, sharedLogos, steamLogoFor } from './logoLibrary'
import { createSteamProject, workingFormats } from '../domain/steamTemplate'
import { captureDesignEdits, composeDesign, placementOf, referencedAssetIds } from '../domain/composition'
import { createProject, pcTemplate } from '../domain/projects'
import type { ImageElement } from '../domain/types'
import { WorkspaceStore } from '../storage/workspaceStore'
import { IndexedDbWorkspaceRepository } from '../storage/workspaceRepository'
import { exportCoverProject, importCoverProject } from '../packages/coverProject'

const repositories: IndexedDbWorkspaceRepository[] = []
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); for (const storage of repositories.splice(0)) storage.close() })
function workspace() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const storage = new IndexedDbWorkspaceRepository('logo-test', new IDBFactory())
  repositories.push(storage)
  return { storage, store: new WorkspaceStore(storage) }
}

describe('shared SVG logos', () => {
  it('uses contrast-aware real logos in both panels and keeps proportions when changing format', () => {
    let project = createSteamProject()
    const find = (suffix: string) => project.composition.elements.find((element) => element.id.endsWith(suffix))! as ImageElement
    expect(find('platform:logo')).toMatchObject({ type: 'image', assetId: steamLogoFor('#102637'), fit: 'contain' })
    expect(find('spine:platform-logo')).toMatchObject({ type: 'image', assetId: steamLogoFor('#ffdb35'), rotation: 90, fit: 'contain' })
    expect(project.composition.elements.some((element) => element.type === 'text' && element.text === 'STEAM')).toBe(false)
    project.composition.design!.styles.colors.brand = '#ffffff'
    project.composition.design!.styles.colors.spine = '#000000'
    project.composition.format = structuredClone(workingFormats[2])
    project = composeDesign(project)
    expect(find('platform:logo').assetId).toBe(steamLogoFor('#ffffff'))
    expect(find('spine:platform-logo').assetId).toBe(steamLogoFor('#000000'))
    expect(find('spine:platform-logo')).toMatchObject({ fit: 'contain', rotation: 90 })
    expect(steamLogoFor('#777777')).toBe(steamLogoFor('#ffffff'))
    expect(steamLogoFor('#555555')).toBe(steamLogoFor('#000000'))
  })

  it('retains placement and visibility overrides from the old Steam text placeholders', () => {
    const project = createSteamProject(), design = project.composition.design!
    const logo = project.composition.elements.find((element) => element.id.endsWith('platform:logo'))!
    const placement = placementOf({ ...logo, x: logo.x + 20, y: logo.y + 10 }, project.composition.format)
    design.overrides[`${design.instanceId}:platform:brand`] = { placement, hidden: true }
    const restored = composeDesign(project).composition.elements.find((element) => element.id === logo.id)!
    expect(restored).toMatchObject({ type: 'image', x: placement.x, y: placement.y, visible: false })
  })

  it('makes logos available to free covers, survives reload and never duplicates builtin blobs in storage', async () => {
    const { store, storage } = workspace(); await store.load()
    const id = store.create()!
    const asset = sharedLogos[0].asset
    const image: ImageElement = { id: 'shared-logo', type: 'image', name: asset.name, assetId: asset.id, x: 700, y: 100,
      width: asset.width, height: asset.height, fit: 'contain', scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, visible: true, locked: false }
    store.changeElements(id, [...store.getSnapshot().projects[0].composition.elements, image])
    await store.flush()
    const steam = store.createSteam()!
    await store.flush()
    expect((await storage.load()).assets).toEqual({})
    const reopened = new WorkspaceStore(storage); await reopened.load()
    expect(reopened.getSnapshot().projects.find((project) => project.id === id)!.composition.elements.at(-1)).toEqual(image)
    expect(referencedAssetIds(reopened.getSnapshot().projects.find((project) => project.id === steam)!)).toHaveLength(2)
    expect(Object.keys(reopened.getSnapshot().assets)).toEqual(Object.keys(builtinAssets))
    expect(await reopened.getSnapshot().assets[asset.id].blob.text()).toBe(sharedLogos[0].svg)
  })

  it('includes SVG bytes in backups and restores into an empty library without asset ID collisions', async () => {
    const original = createSteamProject()
    const blob = await exportCoverProject(original, {})
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()))
    const manifest = JSON.parse(strFromU8(files['manifest.json']))
    expect(manifest.assets).toHaveLength(2)
    for (const descriptor of manifest.assets) {
      expect(descriptor.mimeType).toBe('image/svg+xml')
      expect(descriptor.path).toMatch(/\.svg$/)
      expect(strFromU8(files[descriptor.path])).toBe(await builtinAsset(descriptor.id)!.blob.text())
    }
    const imported = await importCoverProject(blob)
    const { store, storage } = workspace(); await store.load()
    const first = store.importProject(imported.project, imported.assets)
    const second = store.importProject(imported.project, imported.assets)
    await store.flush()
    expect(first).not.toBe(second)
    const recovered = await storage.load()
    expect(recovered.projects).toHaveLength(2)
    expect(recovered.assets).toEqual({})
    for (const project of recovered.projects) expect(referencedAssetIds(project)).toEqual(referencedAssetIds(original))
    const reopened = new WorkspaceStore(storage); await reopened.load()
    expect(reopened.getSnapshot().error).toBeNull()
  })

  it('keeps imported and library logos editable as extras with format adaptation and undo', async () => {
    const { store } = workspace(); await store.load()
    const id = store.createSteam()!
    const project = store.getSnapshot().projects[0]
    const asset = sharedLogos[2].asset
    const image: ImageElement = { id: 'symbol-extra', type: 'image', name: asset.name, assetId: asset.id, x: 700, y: 450,
      width: 90, height: 90, fit: 'contain', scaleX: 1, scaleY: 1, rotation: 15, opacity: 1, visible: true, locked: false }
    store.changeElements(id, [...project.composition.elements, image])
    store.changeFormat(id, workingFormats[2])
    const resized = store.getSnapshot().projects[0].composition.elements.at(-1)!
    expect(resized.scaleX).toBe(resized.scaleY)
    expect(resized.rotation).toBe(15)
    store.undo(id)
    expect(store.getSnapshot().projects[0].composition.elements.at(-1)).toEqual(image)
    await store.flush()
    const modified = captureDesignEdits(project, [...project.composition.elements, image])
    expect(modified.composition.design!.extras[0].element).toEqual(image)
  })

  it('rejects scripted SVGs and forged built-in SVG dimensions in otherwise valid packages', async () => {
    const project = createSteamProject()
    const files = unzipSync(new Uint8Array(await (await exportCoverProject(project, {})).arrayBuffer()))
    const manifest = JSON.parse(strFromU8(files['manifest.json']))
    manifest.assets[0].width += 1
    files['manifest.json'] = strToU8(JSON.stringify(manifest))
    await expect(importCoverProject(new Blob([zipSync(files)]))).rejects.toThrow('Invalid SVG logo')
    const malicious = { ...sharedLogos[0].asset, id: 'unreviewed', blob: new Blob(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], { type: 'image/svg+xml' }) }
    const free = createProject(pcTemplate)
    free.composition.elements.push({ id: 'svg', type: 'image', name: malicious.name, assetId: malicious.id, x: 0, y: 0, width: 294, height: 90, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, visible: true, locked: false })
    await expect(exportCoverProject(free, { [malicious.id]: malicious })).rejects.toThrow('Invalid artwork')
  })
})

import { afterEach, describe, expect, it } from 'vitest'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import type { Unzipped } from 'fflate'
import { IDBFactory } from 'fake-indexeddb'
import { createProject, pcTemplate } from '../domain/projects'
import type { Asset, ImageElement, ProjectPackage } from '../domain/types'
import { IndexedDbWorkspaceRepository } from '../storage/workspaceRepository'
import { WorkspaceStore } from '../storage/workspaceStore'
import { exportCoverProject, importCoverProject, PACKAGE_LIMITS } from './coverProject'

function fixture() {
  const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/ZxkAAAAASUVORK5CYII='), (value) => value.charCodeAt(0))
  const asset: Asset = { id: 'original-art', blob: new Blob([bytes], { type: 'image/png' }), name: 'my artwork.png', mimeType: 'image/png', width: 1, height: 1 }
  const project = createProject(pcTemplate)
  const image: ImageElement = { id: 'image', name: asset.name, type: 'image', assetId: asset.id, x: 700, y: 100, width: 1, height: 1, scaleX: 50, scaleY: 50, rotation: 30, opacity: 0.8, visible: true, locked: false }
  project.name = 'Portable project'
  project.composition.elements.push(image, { ...image, id: 'same-art-twice', x: 100 })
  return { project, asset, assets: { [asset.id]: asset } }
}

async function modifiedPackage(edit: (manifest: ProjectPackage, files: Unzipped) => void): Promise<Blob> {
  const { project, assets } = fixture()
  const blob = await exportCoverProject(project, assets)
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()))
  const manifest = JSON.parse(strFromU8(files['manifest.json'])) as ProjectPackage
  edit(manifest, files)
  files['manifest.json'] = strToU8(JSON.stringify(manifest))
  return new Blob([zipSync(files)])
}

const repositories: IndexedDbWorkspaceRepository[] = []
afterEach(() => { for (const repository of repositories.splice(0)) repository.close() })

describe('.coverproject packages', () => {
  it('preserves raster image filters, backdrop blur and contour shadows in backups', async () => {
    const { project, assets } = fixture()
    const filters = { tint: '#abcdef', blur: 0.2, backdropBlur: 10, shadow: { color: '#123456', opacity: 0.5, blur: 12, offsetX: -3, offsetY: 4 } }
    const image = project.composition.elements.find((element) => element.type === 'image')! as ImageElement
    image.filters = filters
    const imported = await importCoverProject(await exportCoverProject(project, assets))
    expect((imported.project.composition.elements.find((element) => element.id === image.id) as ImageElement).filters).toEqual(filters)
  })

  it('round-trips custom SVG assets through project backups', async () => {
    const { project, asset } = fixture()
    const source = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1"><path d="M0 0h1v1H0z" fill="red"/></svg>'
    const svg = { ...asset, name: 'custom.svg', mimeType: 'image/svg+xml', blob: new Blob([source], { type: 'image/svg+xml' }) }
    const imported = await importCoverProject(await exportCoverProject(project, { [svg.id]: svg }))
    expect(imported.assets[0].mimeType).toBe('image/svg+xml')
    expect(await imported.assets[0].blob.text()).toBe(source)
  })

  it('preserves uploaded project assets that have not been placed on the canvas', async () => {
    const { project, asset, assets } = fixture()
    project.composition.elements = project.composition.elements.filter((element) => element.type !== 'image')
    project.assetIds = [asset.id]
    const imported = await importCoverProject(await exportCoverProject(project, assets))
    expect(imported.assets).toHaveLength(1)
    const repository = new IndexedDbWorkspaceRepository('unused-project-art', new IDBFactory())
    repositories.push(repository)
    const store = new WorkspaceStore(repository)
    await store.load()
    const id = store.importProject(imported.project, imported.assets)
    const restored = store.getSnapshot().projects.find((item) => item.id === id)!
    expect(restored.assetIds).toHaveLength(1)
    expect(restored.assetIds![0]).not.toBe(asset.id)
    expect(store.getSnapshot().assets[restored.assetIds![0]].name).toBe(asset.name)
    await store.flush()
    expect((await repository.load()).projects[0].assetIds).toEqual(restored.assetIds)
  })

  it('round-trips compositions and binary artwork, including shared references', async () => {
    const { project, asset, assets } = fixture()
    const blob = await exportCoverProject(project, assets)
    const imported = await importCoverProject(blob)
    expect(imported.project).toEqual(project)
    expect(imported.assets).toHaveLength(1)
    expect(new Uint8Array(await imported.assets[0].blob.arrayBuffer())).toEqual(new Uint8Array(await asset.blob.arrayBuffer()))
    expect(imported.assets[0]).toMatchObject({ id: asset.id, name: asset.name, mimeType: asset.mimeType, width: 1, height: 1 })
  })

  it('restores in an empty database and survives a fresh connection', async () => {
    const { project, assets, asset } = fixture()
    const imported = await importCoverProject(await exportCoverProject(project, assets))
    const factory = new IDBFactory()
    const storage = new IndexedDbWorkspaceRepository('fresh-library', factory)
    repositories.push(storage)
    const store = new WorkspaceStore(storage)
    await store.load()
    const id = store.importProject(imported.project, imported.assets)
    await store.flush()
    storage.close()
    const reopened = new IndexedDbWorkspaceRepository('fresh-library', factory)
    repositories.push(reopened)
    const recovered = await reopened.load()
    const restored = recovered.projects[0]
    expect(restored.id).toBe(id)
    expect(id).not.toBe(project.id)
    expect(restored.composition.format).toEqual(project.composition.format)
    expect(restored.composition.elements.slice(0, 3).map((element) => ({ ...element, id: 'normalized' }))).toEqual(project.composition.elements.slice(0, 3).map((element) => ({ ...element, id: 'normalized' })))
    const images = restored.composition.elements.filter((element) => element.type === 'image')
    expect(images[0].assetId).toBe(images[1].assetId)
    expect(images[0].assetId).not.toBe(asset.id)
    expect(images[0]).toMatchObject({ x: 700, y: 100, scaleX: 50, rotation: 30, opacity: 0.8 })
    expect(new Uint8Array(await recovered.assets[images[0].assetId].blob.arrayBuffer())).toEqual(new Uint8Array(await asset.blob.arrayBuffer()))
  })

  it('imports the same file repeatedly without replacing original projects or blobs', async () => {
    const { project, asset, assets } = fixture()
    const storage = new IndexedDbWorkspaceRepository('existing-library', new IDBFactory())
    repositories.push(storage)
    await storage.save([project], [asset])
    const store = new WorkspaceStore(storage)
    await store.load()
    const imported = await importCoverProject(await exportCoverProject(project, assets))
    const first = store.importProject(imported.project, imported.assets)
    const second = store.importProject(imported.project, imported.assets)
    expect(first).not.toBe(second)
    await store.flush()
    const recovered = await storage.load()
    expect(recovered.projects).toHaveLength(3)
    expect(Object.keys(recovered.assets)).toHaveLength(3)
    expect(recovered.projects.find((current) => current.id === project.id)).toEqual(project)
  })

  it('exports only referenced assets and supports text-only projects', async () => {
    const project = createProject(pcTemplate)
    const { asset } = fixture()
    const blob = await exportCoverProject(project, { [asset.id]: asset })
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()))
    expect(Object.keys(files)).toEqual(['manifest.json'])
    expect((await importCoverProject(blob)).assets).toEqual([])
  })

  it('rejects unsupported package versions', async () => {
    const blob = await modifiedPackage((manifest) => { Object.assign(manifest, { schemaVersion: 999 }) })
    await expect(importCoverProject(blob)).rejects.toThrow('unsupported version')
  })

  it('rejects malformed composition data', async () => {
    const blob = await modifiedPackage((manifest) => { manifest.project.composition.elements[0].x = Number.NaN })
    await expect(importCoverProject(blob)).rejects.toThrow('invalid composition')
  })

  it('rejects missing and damaged artwork before import', async () => {
    const missing = await modifiedPackage((manifest, files) => { delete files[manifest.assets[0].path] })
    await expect(importCoverProject(missing)).rejects.toThrow('missing or damaged')
    const damaged = await modifiedPackage((manifest, files) => { files[manifest.assets[0].path][20] ^= 1 })
    await expect(importCoverProject(damaged)).rejects.toThrow('missing or damaged')
  })

  it('rejects duplicate assets and required assets absent from the manifest', async () => {
    const duplicate = await modifiedPackage((manifest) => { manifest.assets.push({ ...manifest.assets[0] }) })
    await expect(importCoverProject(duplicate)).rejects.toThrow('duplicate artwork')
    const missing = await modifiedPackage((manifest, files) => { delete files[manifest.assets[0].path]; manifest.assets = [] })
    await expect(importCoverProject(missing)).rejects.toThrow('missing artwork required')
  })

  it('rejects external paths and files absent from the manifest', async () => {
    const external = await modifiedPackage((_manifest, files) => { files['../outside.png'] = new Uint8Array([1]) })
    await expect(importCoverProject(external)).rejects.toThrow('unsupported file path')
    const extra = await modifiedPackage((_manifest, files) => { files['assets/999.png'] = new Uint8Array([1]) })
    await expect(importCoverProject(extra)).rejects.toThrow('not listed')
  })

  it('rejects oversized archives and expansion sizes before decoding', async () => {
    class Oversized extends Blob { get size() { return PACKAGE_LIMITS.archive + 1 } }
    await expect(importCoverProject(new Oversized())).rejects.toThrow('100 MiB')
    const { project, assets } = fixture()
    const bytes = new Uint8Array(await (await exportCoverProject(project, assets)).arrayBuffer())
    const view = new DataView(bytes.buffer)
    for (let index = 0; index < bytes.length - 46; index++) {
      if (view.getUint32(index, true) === 0x02014b50) {
        view.setUint32(index + 24, PACKAGE_LIMITS.expanded + 1, true)
        break
      }
    }
    await expect(importCoverProject(new Blob([bytes]))).rejects.toThrow('limits')
  })

  it('rejects files that are not project ZIPs', async () => {
    await expect(importCoverProject(new Blob(['not a ZIP']))).rejects.toThrow()
    await expect(importCoverProject(new Blob([zipSync({ 'assets/0.png': new Uint8Array([1]) })]))).rejects.toThrow('missing manifest.json')
  })

  it('fails export rather than creating a backup with missing assets', async () => {
    const { project } = fixture()
    await expect(exportCoverProject(project, {})).rejects.toThrow('Missing or unsupported artwork')
  })
})

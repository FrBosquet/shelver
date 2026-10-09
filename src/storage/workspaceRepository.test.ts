import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { createProject, duplicateProject, pcTemplate } from '../domain/projects'
import type { Asset, ImageElement } from '../domain/types'
import { IndexedDbWorkspaceRepository } from './workspaceRepository'

let factory: IDBFactory
const repositories: IndexedDbWorkspaceRepository[] = []
function repository() {
  const result = new IndexedDbWorkspaceRepository('shelver-test', factory)
  repositories.push(result)
  return result
}
function artwork(): Asset {
  return { id: 'artwork', blob: new Blob(['original image bytes'], { type: 'image/png' }), name: 'cover.png', mimeType: 'image/png', width: 600, height: 900 }
}
function image(asset: Asset): ImageElement {
  return { id: 'image', name: asset.name, type: 'image', assetId: asset.id, x: 645, y: 75, width: 600, height: 900, scaleX: 0.5, scaleY: 0.5, rotation: 12, opacity: 0.8, visible: true, locked: false }
}

beforeEach(() => { factory = new IDBFactory() })
afterEach(() => { for (const item of repositories.splice(0)) item.close() })

describe('IndexedDB workspace', () => {
  it('opens a new empty library', async () => {
    await expect(repository().load()).resolves.toEqual({ projects: [], assets: {} })
  })

  it('restores text, transforms, and real blob bytes after closing the connection', async () => {
    const project = createProject(pcTemplate)
    const asset = artwork()
    project.name = 'Persistent cover'
    const title = project.composition.elements[0]
    if (title.type === 'text') title.text = 'A title that survives a reload'
    project.composition.elements.push(image(asset))
    const first = repository()
    await first.save([project], [asset])
    first.close()

    const recovered = await repository().load()
    expect(recovered.projects).toEqual([project])
    expect(recovered.assets[asset.id].blob).toBeInstanceOf(Blob)
    expect(await recovered.assets[asset.id].blob.text()).toBe('original image bytes')
    expect(recovered.assets[asset.id].name).toBe('cover.png')
  })

  it('persists independent duplicates while sharing immutable artwork', async () => {
    const storage = repository()
    const original = createProject(pcTemplate)
    const asset = artwork()
    original.composition.elements.push(image(asset))
    await storage.save([original], [asset])
    const copy = duplicateProject(original)
    copy.composition.elements[0].x = 99
    const copyImage = copy.composition.elements.at(-1)!
    if (copyImage.type === 'image') copyImage.assetId = 'replacement'
    const replacement = { ...artwork(), id: 'replacement', blob: new Blob(['replacement bytes']) }
    await storage.save([copy], [replacement])
    const recovered = await storage.load()
    expect(recovered.projects.find((project) => project.id === original.id)).toEqual(original)
    expect(recovered.projects.find((project) => project.id === copy.id)).toEqual(copy)
    expect(Object.keys(recovered.assets)).toHaveLength(2)
    expect(await recovered.assets.artwork.blob.text()).toBe('original image bytes')
  })

  it('updates only dirty projects, preserving projects saved by another connection', async () => {
    const first = repository()
    const second = repository()
    const projectA = createProject(pcTemplate)
    const projectB = createProject(pcTemplate)
    await first.save([projectA], [])
    await second.save([projectB], [])
    projectA.name = 'Renamed'
    await first.save([projectA], [])
    expect((await second.load()).projects).toHaveLength(2)
  })

  it('rolls back all project writes when an asset write fails', async () => {
    const storage = repository()
    const asset = artwork()
    const project = createProject(pcTemplate)
    await storage.save([project], [asset])
    const changed = { ...project, name: 'Must not commit' }
    const another = createProject(pcTemplate)
    // add(), rather than put(), makes existing assets immutable and aborts this transaction.
    await expect(storage.save([changed, another], [asset])).rejects.toMatchObject({ name: 'ConstraintError' })
    const recovered = await storage.load()
    expect(recovered.projects).toEqual([project])
    expect(await recovered.assets.artwork.blob.text()).toBe('original image bytes')
  })

  it('rejects newer project schemas without erasing them', async () => {
    const storage = repository()
    const project = createProject(pcTemplate)
    // Simulate a project written by a future release.
    Object.assign(project, { schemaVersion: 2 })
    await storage.save([project], [])
    await expect(storage.load()).rejects.toThrow('unsupported version')
    await expect(repository().load()).rejects.toThrow('unsupported version')
  })

  it('rejects compositions referencing missing artwork', async () => {
    const storage = repository()
    const project = createProject(pcTemplate)
    project.composition.elements.push(image(artwork()))
    await storage.save([project], [])
    await expect(storage.load()).rejects.toThrow('Artwork is missing')
  })

  it('reports browsers without IndexedDB', async () => {
    const unavailable = new IndexedDbWorkspaceRepository('unavailable')
    await expect(unavailable.load()).rejects.toThrow('unavailable in this browser')
  })
})

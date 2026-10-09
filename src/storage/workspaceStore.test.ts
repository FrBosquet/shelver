import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { createProject, pcTemplate } from '../domain/projects'
import type { Asset, ImageElement } from '../domain/types'
import { IndexedDbWorkspaceRepository } from './workspaceRepository'
import type { WorkspaceData } from './workspaceRepository'
import { WorkspaceStore } from './workspaceStore'

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

const repositories: IndexedDbWorkspaceRepository[] = []
function repository() {
  const storage = new IndexedDbWorkspaceRepository('store-test', new IDBFactory())
  repositories.push(storage)
  return storage
}

beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }) })
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  for (const storage of repositories.splice(0)) storage.close()
})

describe('autosave', () => {
  it('restores image filters, blur and shadows after saving and reopening, including subsequent template edits and resets', async () => {
    const storage = repository()
    const store = new WorkspaceStore(storage)
    await store.load()
    const id = store.createSteam()!
    const current = () => store.getSnapshot().projects.find((project) => project.id === id)!
    const original = current().composition.elements.find((element) => element.type === 'image')! as ImageElement
    const filters = { brightness: 0.25, contrast: -0.1, saturation: 0.4, grayscale: true, invert: true, tint: '#123456', blur: 0.15, backdropBlur: 8, shadow: { color: '#000000', opacity: 0.6, blur: 12, offsetX: 3, offsetY: 4 } }
    store.changeElements(id, current().composition.elements.map((element) => element.id === original.id ? { ...original, filters } : element), undefined, `svg-filters:${original.id}`)
    const design = structuredClone(current().composition.design!)
    design.shared.title = 'Updated title'
    store.updateDesign(id, design)
    await store.flush()
    const reopened = new WorkspaceStore(storage)
    await reopened.load()
    const restored = reopened.getSnapshot().projects.find((project) => project.id === id)!
    expect((restored.composition.elements.find((element) => element.id === original.id) as ImageElement).filters).toEqual(filters)
    expect((restored.composition.design!.overrides[original.id].replacement as ImageElement).filters).toEqual(filters)
    reopened.changeElements(id, restored.composition.elements.map((element) => element.id === original.id ? { ...element, filters: {} } : element))
    await reopened.flush()
    const reset = new WorkspaceStore(storage)
    await reset.load()
    expect((reset.getSnapshot().projects.find((project) => project.id === id)!.composition.elements.find((element) => element.id === original.id) as ImageElement).filters).toEqual({})
  })

  it('saves uploads in the project library without placing or remounting canvas elements', async () => {
    const storage = repository()
    const store = new WorkspaceStore(storage)
    await store.load()
    const id = store.createSteam()!
    const before = store.getSnapshot().projects.find((item) => item.id === id)!
    const revision = store.getSnapshot().history[id].revision
    const asset: Asset = { id: 'unplaced', name: 'Artwork', blob: new Blob(['art'], { type: 'image/png' }), mimeType: 'image/png', width: 1, height: 1 }
    store.addProjectAssets(id, [asset])
    expect(store.getSnapshot().projects.find((item) => item.id === id)!.composition).toEqual(before.composition)
    expect(store.getSnapshot().history[id].revision).toBe(revision)
    await store.flush()
    const data = await storage.load()
    expect(data.projects[0].assetIds).toEqual([asset.id])
    expect(data.assets[asset.id].name).toBe(asset.name)
  })

  it('restores an individual template element without remounting the editor and supports undo', async () => {
    const store = new WorkspaceStore(repository())
    await store.load()
    const id = store.createSteam()!
    const project = store.getSnapshot().projects.find((item) => item.id === id)!
    const element = project.composition.elements.find((item) => item.type === 'text' && item.blockId)!
    const design = structuredClone(project.composition.design!)
    design.overrides[element.id] = { text: 'Individual content' }
    store.updateDesign(id, design)
    const revision = store.getSnapshot().history[id].revision
    delete design.overrides[element.id]
    store.updateDesign(id, design, [], undefined, false)
    expect(store.getSnapshot().history[id].revision).toBe(revision)
    expect(store.getSnapshot().projects.find((item) => item.id === id)!.composition.elements.find((item) => item.id === element.id)).toEqual(element)
    store.undo(id)
    expect(store.getSnapshot().projects.find((item) => item.id === id)!.composition.design!.overrides[element.id].text).toBe('Individual content')
    expect(store.getSnapshot().history[id].revision).toBeGreaterThan(revision)
  })

  it('waits for hydration before allowing changes and loads only once', async () => {
    const data = deferred<WorkspaceData>()
    const load = vi.fn(() => data.promise)
    const storage = { load, save: vi.fn(async () => {}) }
    const store = new WorkspaceStore(storage)
    const opening = store.load()
    const repeated = store.load()
    expect(store.create()).toBeNull()
    expect(load).toHaveBeenCalledTimes(1)
    const existing = createProject(pcTemplate)
    data.resolve({ projects: [existing], assets: {} })
    await Promise.all([opening, repeated])
    expect(store.getSnapshot()).toMatchObject({ loaded: true, status: 'saved', projects: [existing] })
    expect(storage.save).not.toHaveBeenCalled()
  })

  it('restarts the 800 ms debounce on every edit and saves only the latest value', async () => {
    const storage = { load: vi.fn(async () => ({ projects: [], assets: {} })), save: vi.fn(async () => {}) }
    const store = new WorkspaceStore(storage)
    await store.load()
    const id = store.create()!
    store.rename(id, 'First')
    await vi.advanceTimersByTimeAsync(700)
    store.rename(id, 'Final name')
    expect(store.getSnapshot().status).toBe('pending')
    await vi.advanceTimersByTimeAsync(799)
    expect(storage.save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(storage.save).toHaveBeenCalledTimes(1)
    expect(storage.save.mock.calls[0]).toEqual([[expect.objectContaining({ name: 'Final name' })], []])
    expect(store.getSnapshot().status).toBe('saved')
  })

  it('keeps slider changes in memory throughout a long gesture and saves once after release', async () => {
    const storage = { load: async () => ({ projects: [], assets: {} }), save: vi.fn(async () => {}) }
    const store = new WorkspaceStore(storage)
    await store.load()
    const id = store.createSteam()!
    const design = structuredClone(store.getSnapshot().projects[0].composition.design!)
    const asset: Asset = { id: 'art', blob: new Blob(['art']), name: 'art.png', mimeType: 'image/png', width: 100, height: 200 }
    design.images.frontArt = { assetId: asset.id, fit: 'cover', focalX: 0.5, focalY: 0.5 }
    store.updateDesign(id, design, [asset])
    await vi.advanceTimersByTimeAsync(700)
    store.beginInteraction()
    for (const focalX of [0.2, 0.6, 0.9]) {
      const next = structuredClone(store.getSnapshot().projects[0].composition.design!)
      next.images.frontArt.focalX = focalX
      store.updateDesign(id, next, [], 'focus:frontArt:focalX')
      await vi.advanceTimersByTimeAsync(1500)
      expect(storage.save).not.toHaveBeenCalled()
      expect(store.getSnapshot().projects[0].composition.design!.images.frontArt.focalX).toBe(focalX)
    }
    expect(store.getSnapshot().status).toBe('pending')
    store.endInteraction()
    await vi.advanceTimersByTimeAsync(799)
    expect(storage.save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(storage.save.mock.calls).toEqual([[
      [expect.objectContaining({ composition: expect.objectContaining({ design: expect.objectContaining({ images: expect.objectContaining({ frontArt: expect.objectContaining({ focalX: 0.9 }) }) }) }) })],
      [asset],
    ]])
    expect(store.hasUnsavedChanges()).toBe(false)
  })

  it('does not bypass debounce for edits made during an automatic write', async () => {
    const first = deferred<void>()
    const second = deferred<void>()
    const save = vi.fn(async () => {}).mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise)
    const store = new WorkspaceStore({ load: async () => ({ projects: [], assets: {} }), save })
    await store.load()
    const id = store.create()!
    await vi.advanceTimersByTimeAsync(800)
    expect(save).toHaveBeenCalledTimes(1)
    expect(store.getSnapshot().status).toBe('saving')
    store.rename(id, 'Final value')
    first.resolve()
    await vi.advanceTimersByTimeAsync(799)
    expect(save).toHaveBeenCalledTimes(1)
    expect(store.getSnapshot().status).toBe('pending')
    expect(store.hasUnsavedChanges()).toBe(true)
    await vi.advanceTimersByTimeAsync(1)
    expect(save).toHaveBeenCalledTimes(2)
    expect(store.getSnapshot().status).toBe('saving')
    second.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(store.getSnapshot().status).toBe('saved')
  })

  it('reschedules pending edits if their debounce expires while a slow write is running', async () => {
    const first = deferred<void>()
    const save = vi.fn(async () => {}).mockImplementationOnce(() => first.promise)
    const store = new WorkspaceStore({ load: async () => ({ projects: [], assets: {} }), save })
    await store.load()
    const id = store.create()!
    await vi.advanceTimersByTimeAsync(800)
    store.rename(id, 'While busy')
    await vi.advanceTimersByTimeAsync(2000)
    expect(save).toHaveBeenCalledTimes(1)
    first.resolve()
    await vi.advanceTimersByTimeAsync(799)
    expect(save).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(save).toHaveBeenCalledTimes(2)
    expect(store.getSnapshot().status).toBe('saved')
  })

  it('flushes immediately even during a gesture and still debounces later edits', async () => {
    const storage = { load: async () => ({ projects: [], assets: {} }), save: vi.fn(async () => {}) }
    const store = new WorkspaceStore(storage)
    await store.load()
    const id = store.create()!
    store.beginInteraction()
    await store.flush()
    expect(storage.save).toHaveBeenCalledTimes(1)
    await store.flush() // An empty forced flush must not force the next autosave.
    store.rename(id, 'After hiding')
    await vi.advanceTimersByTimeAsync(2000)
    expect(storage.save).toHaveBeenCalledTimes(1)
    store.endInteraction()
    await vi.advanceTimersByTimeAsync(800)
    expect(storage.save).toHaveBeenCalledTimes(2)
    expect(store.getSnapshot().status).toBe('saved')
    store.endInteraction() // Duplicate release must not suspend future saves.
    store.rename(id, 'Next edit')
    await vi.advanceTimersByTimeAsync(800)
    expect(storage.save).toHaveBeenCalledTimes(3)
  })

  it('drains newer edits when an explicit flush joins an automatic write', async () => {
    const first = deferred<void>()
    const save = vi.fn(async () => {}).mockImplementationOnce(() => first.promise)
    const store = new WorkspaceStore({ load: async () => ({ projects: [], assets: {} }), save })
    await store.load()
    const id = store.create()!
    await vi.advanceTimersByTimeAsync(800)
    store.beginInteraction()
    store.rename(id, 'Latest before closing')
    const closing = store.flush()
    first.resolve()
    await closing
    expect(save).toHaveBeenCalledTimes(2)
    expect(save.mock.calls[1]).toEqual([[expect.objectContaining({ name: 'Latest before closing' })], []])
    expect(store.getSnapshot().status).toBe('saved')
    store.endInteraction()
  })

  it('keeps edits made during an in-flight save pending until their own transaction commits', async () => {
    const first = deferred<void>()
    const second = deferred<void>()
    const storage = repository()
    const save = vi.fn(storage.save.bind(storage))
      .mockImplementationOnce(async (projects, assets) => { await first.promise; await storage.save(projects, assets) })
      .mockImplementationOnce(async (projects, assets) => { await second.promise; await storage.save(projects, assets) })
    const store = new WorkspaceStore({ load: storage.load.bind(storage), save })
    await store.load()
    const id = store.create()!
    const saving = store.flush()
    store.rename(id, 'Changed while saving')
    first.resolve()
    await vi.waitFor(() => { expect(save).toHaveBeenCalledTimes(2) })
    expect(store.getSnapshot().status).toBe('saving')
    expect(store.hasUnsavedChanges()).toBe(true)
    second.resolve()
    await saving
    expect(store.getSnapshot().status).toBe('saved')
    expect(store.hasUnsavedChanges()).toBe(false)
    expect((await storage.load()).projects[0].name).toBe('Changed while saving')
  })

  it('retains unsaved projects and artwork after quota failure, then retries successfully', async () => {
    const storage = repository()
    const save = vi.fn(storage.save.bind(storage)).mockRejectedValueOnce(new DOMException('Disk full', 'QuotaExceededError'))
    const store = new WorkspaceStore({ load: storage.load.bind(storage), save })
    await store.load()
    const id = store.create()!
    const asset: Asset = { id: 'art', blob: new Blob(['art bytes']), name: 'art.png', mimeType: 'image/png', width: 100, height: 200 }
    const elements = store.getSnapshot().projects[0].composition.elements
    store.changeElements(id, [...elements, { id: 'image', name: asset.name, type: 'image', assetId: asset.id, x: 100, y: 100, width: 100, height: 200, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, visible: true, locked: false }], asset)
    await store.flush()
    expect(store.getSnapshot().status).toBe('error')
    expect(store.getSnapshot().error).toContain('storage is full')
    expect(store.hasUnsavedChanges()).toBe(true)
    expect((await storage.load()).projects).toHaveLength(0)
    await store.retry()
    expect(store.getSnapshot()).toMatchObject({ status: 'saved', error: null })
    const recovered = await storage.load()
    expect(recovered.projects[0].composition.elements.at(-1)).toMatchObject({ assetId: asset.id })
    expect(await recovered.assets.art.blob.text()).toBe('art bytes')
  })

  it('does not label interrupted transactions as saved', async () => {
    const storage = { load: async () => ({ projects: [], assets: {} }), save: vi.fn(async () => { throw new DOMException('Interrupted', 'AbortError') }) }
    const store = new WorkspaceStore(storage)
    await store.load()
    store.create()
    await store.flush()
    expect(store.getSnapshot().status).toBe('error')
    expect(store.hasUnsavedChanges()).toBe(true)
    expect(store.getSnapshot().error).toContain('not be saved')
  })

  it('leaves a failed library closed and retries loading without overwriting it', async () => {
    const existing = createProject(pcTemplate)
    const storage = { load: vi.fn().mockRejectedValueOnce(new DOMException('Denied', 'SecurityError')).mockResolvedValueOnce({ projects: [existing], assets: {} }), save: vi.fn(async () => {}) }
    const store = new WorkspaceStore(storage)
    await store.load()
    expect(store.getSnapshot()).toMatchObject({ loaded: false, status: 'error' })
    expect(store.create()).toBeNull()
    await store.retry()
    expect(store.getSnapshot().projects).toEqual([existing])
    expect(storage.save).not.toHaveBeenCalled()
  })

  it('saves copies without changing the original composition', async () => {
    const storage = repository()
    const store = new WorkspaceStore(storage)
    await store.load()
    const id = store.create()!
    store.rename(id, 'Original')
    await store.flush()
    store.duplicate(id)
    const copy = store.getSnapshot().projects.find((project) => project.id !== id)!
    const elements = structuredClone(copy.composition.elements)
    elements[0].x = 900
    store.changeElements(copy.id, elements)
    await store.flush()
    const recovered = await storage.load()
    expect(recovered.projects.find((project) => project.id === id)!.composition.elements[0].x).toBe(670)
    expect(recovered.projects.find((project) => project.id === copy.id)!.composition.elements[0].x).toBe(900)
  })
})

describe('session history', () => {
  it('groups successive name edits into one undo step and restores the final name with redo', async () => {
    const store = new WorkspaceStore(repository())
    await store.load()
    const id = store.create()!
    store.rename(id, 'F')
    store.rename(id, 'Final title')
    store.undo(id)
    expect(store.getSnapshot().projects[0].name).toBe('Untitled cover')
    expect(store.getSnapshot().history[id]).toMatchObject({ canUndo: false, canRedo: true, revision: 1 })
    store.redo(id)
    expect(store.getSnapshot().projects[0].name).toBe('Final title')
    await store.flush()
  })

  it('restores text, transforms, and deletions and autosaves the restored composition', async () => {
    const storage = repository()
    const store = new WorkspaceStore(storage)
    await store.load()
    const id = store.create()!
    const original = structuredClone(store.getSnapshot().projects[0].composition)
    const moved = structuredClone(original.elements)
    Object.assign(moved[0], { x: 200, y: 300, scaleX: 0.7, scaleY: 0.8, rotation: 45, opacity: 0.4 })
    store.changeElements(id, moved)
    const text = structuredClone(moved)
    if (text[0].type === 'text') text[0].text = 'Rewritten title'
    store.changeElements(id, text, undefined, 'text:starter-title')
    store.changeElements(id, text.slice(1))
    store.undo(id)
    expect(store.getSnapshot().projects[0].composition.elements).toEqual(text)
    store.undo(id)
    expect(store.getSnapshot().projects[0].composition.elements).toEqual(moved)
    store.undo(id)
    expect(store.getSnapshot().projects[0].composition).toEqual(original)
    await store.flush()
    expect((await storage.load()).projects[0].composition).toEqual(original)
    store.redo(id)
    store.redo(id)
    store.redo(id)
    expect(store.getSnapshot().projects[0].composition.elements).toEqual(text.slice(1))
    await store.flush()
  })

  it('groups typing by text element, without combining edits to different text elements', async () => {
    const store = new WorkspaceStore(repository())
    await store.load()
    const id = store.create()!
    const original = structuredClone(store.getSnapshot().projects[0].composition.elements)
    const elements = structuredClone(original)
    if (elements[0].type === 'text') elements[0].text = 'A'
    store.changeElements(id, elements, undefined, 'text:first')
    if (elements[0].type === 'text') elements[0].text = 'An entire sentence'
    store.changeElements(id, elements, undefined, 'text:first')
    if (elements[1].type === 'text') elements[1].text = 'Different text'
    store.changeElements(id, elements, undefined, 'text:second')
    store.undo(id)
    expect(store.getSnapshot().projects[0].composition.elements[0]).toMatchObject({ text: 'An entire sentence' })
    store.undo(id)
    expect(store.getSnapshot().projects[0].composition.elements).toEqual(original)
    await store.flush()
  })

  it('retains original and replacement artwork for undo and redo, including deleted images', async () => {
    const storage = repository()
    const store = new WorkspaceStore(storage)
    await store.load()
    const id = store.create()!
    const originalElements = structuredClone(store.getSnapshot().projects[0].composition.elements)
    const asset: Asset = { id: 'original-art', name: 'original.png', blob: new Blob(['original']), mimeType: 'image/png', width: 100, height: 100 }
    const image = { id: 'image', name: asset.name, type: 'image' as const, assetId: asset.id, x: 100, y: 100, width: 100, height: 100, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, visible: true, locked: false }
    store.changeElements(id, [...originalElements, image], asset)
    const replacement = { ...asset, id: 'replacement', blob: new Blob(['replacement']) }
    store.changeElements(id, [...originalElements, { ...image, assetId: replacement.id }], replacement)
    store.changeElements(id, originalElements)
    store.undo(id)
    expect(store.getSnapshot().projects[0].composition.elements.at(-1)).toMatchObject({ assetId: replacement.id })
    store.undo(id)
    expect(store.getSnapshot().projects[0].composition.elements.at(-1)).toMatchObject({ assetId: asset.id })
    store.undo(id)
    expect(store.getSnapshot().projects[0].composition.elements).toEqual(originalElements)
    store.redo(id)
    store.redo(id)
    await store.flush()
    const recovered = await storage.load()
    expect(recovered.projects[0].composition.elements.at(-1)).toMatchObject({ assetId: replacement.id })
    expect(await recovered.assets[asset.id].blob.text()).toBe('original')
    expect(await recovered.assets[replacement.id].blob.text()).toBe('replacement')
  })

  it('discards the redo branch after a new edit and keeps other projects independent', async () => {
    const store = new WorkspaceStore(repository())
    await store.load()
    const first = store.create()!
    const second = store.create()!
    store.rename(first, 'First')
    store.rename(second, 'Second')
    store.undo(first)
    store.rename(first, 'New branch')
    expect(store.getSnapshot().history[first].canRedo).toBe(false)
    store.redo(first)
    expect(store.getSnapshot().projects.find((project) => project.id === first)!.name).toBe('New branch')
    expect(store.getSnapshot().projects.find((project) => project.id === second)!.name).toBe('Second')
    store.undo(second)
    expect(store.getSnapshot().projects.find((project) => project.id === first)!.name).toBe('New branch')
    await store.flush()
  })

  it('starts a fresh history after reopening the library', async () => {
    const storage = repository()
    const store = new WorkspaceStore(storage)
    await store.load()
    const id = store.create()!
    store.rename(id, 'Saved title')
    await store.flush()
    const reopened = new WorkspaceStore(storage)
    await reopened.load()
    expect(reopened.getSnapshot().history).toEqual({})
    reopened.undo(id)
    expect(reopened.getSnapshot().projects[0].name).toBe('Saved title')
  })

  it('limits history to 100 steps without storing image blobs in each snapshot', async () => {
    const store = new WorkspaceStore(repository())
    await store.load()
    const id = store.create()!
    const elements = structuredClone(store.getSnapshot().projects[0].composition.elements)
    for (let index = 1; index <= 105; index++) {
      elements[0].x = 670 + index
      store.changeElements(id, elements)
    }
    for (let index = 0; index < 100; index++) store.undo(id)
    expect(store.getSnapshot().projects[0].composition.elements[0].x).toBe(675)
    expect(store.getSnapshot().history[id].canUndo).toBe(false)
    await store.flush()
  })
})

describe('cover deletion', () => {
  it('persists deletion without affecting another cover or its shared artwork', async () => {
    const storage = repository()
    const store = new WorkspaceStore(storage)
    await store.load()
    const id = store.create()!
    const asset: Asset = { id: 'shared', name: 'art.png', blob: new Blob(['art']), mimeType: 'image/png', width: 100, height: 100 }
    const elements = store.getSnapshot().projects[0].composition.elements
    store.changeElements(id, [...elements, { id: 'image', name: 'Art', type: 'image', assetId: asset.id, x: 0, y: 0, width: 100, height: 100, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, visible: true, locked: false }], asset)
    store.duplicate(id)
    await store.flush()
    store.deleteProject(id)
    store.undo(id)
    await store.flush()
    const reopened = new WorkspaceStore(storage)
    await reopened.load()
    expect(reopened.getSnapshot().projects).toHaveLength(1)
    expect(reopened.getSnapshot().projects[0].id).not.toBe(id)
    expect(reopened.getSnapshot().assets.shared).toBeDefined()
    expect(store.getSnapshot().history[id]).toBeUndefined()
  })

  it('retries a failed deletion', async () => {
    const storage = repository()
    const save = vi.fn(storage.save.bind(storage))
    const store = new WorkspaceStore({ load: storage.load.bind(storage), save })
    await store.load()
    const id = store.create()!
    await store.flush()
    save.mockRejectedValueOnce(new Error('Interrupted'))
    store.deleteProject(id)
    await store.flush()
    expect(store.getSnapshot().status).toBe('error')
    expect(store.hasUnsavedChanges()).toBe(true)
    await store.retry()
    expect((await storage.load()).projects).toEqual([])
  })

  it('deletes a cover while its creation is being saved', async () => {
    const storage = repository()
    const first = deferred<void>()
    const save = vi.fn(storage.save.bind(storage)).mockImplementationOnce(async (projects, assets) => {
      await first.promise
      await storage.save(projects, assets)
    })
    const store = new WorkspaceStore({ load: storage.load.bind(storage), save })
    await store.load()
    const id = store.create()!
    const saving = store.flush()
    store.deleteProject(id)
    first.resolve()
    await saving
    expect((await storage.load()).projects).toEqual([])
    expect(store.hasUnsavedChanges()).toBe(false)
  })
})

it('does not insert an existing image again when reusing artwork and editing a slider', async () => {
  const storage = repository()
  const store = new WorkspaceStore(storage)
  await store.load()
  const id = store.createSteam()!
  const asset: Asset = { id: 'shared-art', name: 'Artwork', blob: new Blob(['art'], { type: 'image/png' }), mimeType: 'image/png', width: 1, height: 1 }
  store.addProjectAssets(id, [asset])
  await store.flush()
  store.addProjectAssets(id, [{ ...asset }])
  const elements = store.getSnapshot().projects[0].composition.elements.map((element) => element.type === 'image' ? { ...element, imageScale: 1.25 } : element)
  store.changeElements(id, elements)
  await store.flush()
  expect(store.getSnapshot()).toMatchObject({ status: 'saved', error: null })
  expect(Object.keys((await storage.load()).assets)).toEqual([asset.id])
})

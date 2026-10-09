import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { createProject, pcTemplate } from '../domain/projects'
import type { Asset } from '../domain/types'
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

  it('coalesces rapid edits and saves automatically after 300 ms', async () => {
    const storage = { load: vi.fn(async () => ({ projects: [], assets: {} })), save: vi.fn(async () => {}) }
    const store = new WorkspaceStore(storage)
    await store.load()
    const id = store.create()!
    store.rename(id, 'First')
    store.rename(id, 'Final name')
    expect(store.getSnapshot().status).toBe('saving')
    await vi.advanceTimersByTimeAsync(299)
    expect(storage.save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(storage.save).toHaveBeenCalledTimes(1)
    expect(storage.save.mock.calls[0]).toEqual([[expect.objectContaining({ name: 'Final name' })], []])
    expect(store.getSnapshot().status).toBe('saved')
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

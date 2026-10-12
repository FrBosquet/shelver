import { remapElementAssets } from '../domain/elementTypes'
import { createProject, duplicateProject, pcTemplate } from '../domain/projects'
import type { Asset, CoverDesign, Element, Format, Project } from '../domain/types'
import { adaptElement, captureDesignEdits, composeDesign, placementOf, referencedAssetIds, remapDesign } from '../domain/composition'
import { createSteamProject } from '../domain/steamTemplate'
import { validAsset, validProject } from '../domain/validation'
import type { WorkspaceData, WorkspaceRepository } from './workspaceRepository'
import { builtinAsset, builtinAssets } from '../assets/logoLibrary'

export type SaveStatus = 'loading' | 'pending' | 'saving' | 'saved' | 'error'
const AUTOSAVE_DELAY = 800
export type WorkspaceSnapshot = WorkspaceData & {
  loaded: boolean
  status: SaveStatus
  error: string | null
  history: Record<string, { canUndo: boolean; canRedo: boolean; revision: number }>
}

type History = { past: Project[]; future: Project[]; revision: number; group?: { key: string; time: number } }

function storageError(error: unknown, loading: boolean): string {
  if (error instanceof Error && error.name === 'QuotaExceededError') {
    return 'Browser storage is full. Your latest changes are not saved. Free up space and retry; you can still export a PNG.'
  }
  if (error instanceof Error && error.name === 'VersionError') {
    return 'This library was saved with a newer version of Game Shelver. Update the app before opening it.'
  }
  const detail = error instanceof Error ? ` ${error.message}` : ''
  return loading
    ? `Unable to open your local library.${detail}`
    : `Your latest changes could not be saved. Keep this tab open and retry.${detail}`
}

export class WorkspaceStore {
  private repository: WorkspaceRepository
  private snapshot: WorkspaceSnapshot = { projects: [], assets: {}, loaded: false, status: 'loading', error: null, history: {} }
  private listeners = new Set<() => void>()
  private pendingProjects = new Map<string, Project>()
  private pendingAssets = new Map<string, Asset>()
  private pendingDeletions = new Set<string>()
  private timer: ReturnType<typeof setTimeout> | undefined
  private loading: Promise<void> | undefined
  private saving: Promise<void> | undefined
  private forceSave = false
  private interactions = 0
  private histories = new Map<string, History>()

  constructor(repository: WorkspaceRepository) { this.repository = repository }

  getSnapshot = (): WorkspaceSnapshot => this.snapshot
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  private publish(update: Partial<WorkspaceSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...update }
    for (const listener of this.listeners) listener()
  }

  load = (): Promise<void> => {
    if (this.snapshot.loaded) return Promise.resolve()
    if (this.loading) return this.loading
    this.publish({ status: 'loading', error: null })
    this.loading = this.repository.load().then((data) => {
      this.publish({ ...data, assets: { ...data.assets, ...builtinAssets }, projects: data.projects.map(composeDesign), loaded: true, status: 'saved', error: null })
    }).catch((error: unknown) => {
      this.publish({ status: 'error', error: storageError(error, true) })
    }).finally(() => { this.loading = undefined })
    return this.loading
  }

  addProjectAssets(id: string, assets: Asset[]): void {
    const project = this.snapshot.projects.find((item) => item.id === id)
    if (!project || !assets.length) return
    if (!assets.every(validAsset)) throw new Error('Invalid artwork.')
    this.queue({ ...project, assetIds: [...new Set([...(project.assetIds ?? []), ...assets.map((asset) => asset.id)])], updatedAt: new Date().toISOString() }, assets)
  }

  private queue(project: Project, assets: Asset[] = []): void {
    this.pendingProjects.set(project.id, project)
    // Artwork is immutable and shared by ID. Reusing it must not enqueue
    // another add(), including while its first save is still in flight.
    const newAssets = assets.filter((asset) => !builtinAsset(asset.id) && !this.snapshot.assets[asset.id])
    for (const asset of newAssets) this.pendingAssets.set(asset.id, asset)
    const exists = this.snapshot.projects.some((current) => current.id === project.id)
    const projects = exists
      ? this.snapshot.projects.map((current) => current.id === project.id ? project : current)
      : [project, ...this.snapshot.projects]
    this.publish({
      projects, assets: newAssets.length ? { ...this.snapshot.assets, ...Object.fromEntries(newAssets.map((asset) => [asset.id, asset])) } : this.snapshot.assets,
      history: { ...this.snapshot.history, [project.id]: this.historyState(project.id) },
      status: this.saving ? 'saving' : 'pending', error: null,
    })
    this.scheduleSave()
  }

  private scheduleSave(): void {
    clearTimeout(this.timer)
    this.timer = undefined
    if (this.interactions || !this.hasUnsavedChanges()) return
    this.timer = setTimeout(() => {
      this.timer = undefined
      void this.startSave(false)
    }, AUTOSAVE_DELAY)
  }

  beginInteraction = (): void => {
    this.interactions += 1
    clearTimeout(this.timer)
    this.timer = undefined
  }

  endInteraction = (): void => {
    if (!this.interactions) return
    this.interactions -= 1
    if (!this.interactions) this.scheduleSave()
  }

  private historyState(id: string) {
    const history = this.histories.get(id)
    return { canUndo: Boolean(history?.past.length), canRedo: Boolean(history?.future.length), revision: history?.revision ?? 0 }
  }

  private record(project: Project, group?: string): void {
    const history = this.histories.get(project.id) ?? { past: [], future: [], revision: 0 }
    const time = Date.now()
    if (!group || !history.group || history.group.key !== group || time - history.group.time > 750 || history.future.length) {
      history.past.push(structuredClone(project))
      if (history.past.length > 100) history.past.shift()
    }
    history.future = []
    history.group = group ? { key: group, time } : undefined
    this.histories.set(project.id, history)
  }

  undo(id: string): void { this.travel(id, 'undo') }
  redo(id: string): void { this.travel(id, 'redo') }

  private travel(id: string, direction: 'undo' | 'redo'): void {
    const current = this.snapshot.projects.find((project) => project.id === id)
    const history = this.histories.get(id)
    if (!current || !history) return
    const from = direction === 'undo' ? history.past : history.future
    const to = direction === 'undo' ? history.future : history.past
    const previous = from.pop()
    if (!previous) return
    to.push(structuredClone(current))
    history.group = undefined
    history.revision += 1
    this.queue({ ...previous, updatedAt: new Date().toISOString() })
  }

  importProject(project: Project, assets: Asset[]): string {
    if (!this.snapshot.loaded) throw new Error('Open your local library before importing a project.')
    if (!validProject(project) || !assets.every(validAsset)) throw new Error('The imported project is invalid.')
    const incoming = new Map(assets.map((asset) => [asset.id, asset]))
    if (incoming.size !== assets.length || referencedAssetIds(project).some((id) => !incoming.has(id))) throw new Error('The imported project is missing artwork or has duplicate assets.')
    const mapped = new Map(assets.map((asset) => [asset.id, builtinAsset(asset.id) ?? { ...asset, id: crypto.randomUUID() }]))
    const imported = structuredClone(project)
    if (imported.assetIds) imported.assetIds = imported.assetIds.map((id) => mapped.get(id)!.id)
    imported.id = crypto.randomUUID()
    imported.createdAt = imported.updatedAt = new Date().toISOString()
    if (this.snapshot.projects.some((current) => current.name === imported.name)) imported.name += ' (imported)'
    const elementIds = new Map(imported.composition.elements.map((element) => [element.id, crypto.randomUUID()]))
    const assetIds = new Map([...mapped].map(([id, asset]) => [id, asset.id]))
    imported.composition.elements = imported.composition.elements.map((element) => remapElementAssets({ ...element, id: elementIds.get(element.id)! }, assetIds))
    if (imported.composition.design) imported.composition.design = remapDesign(imported.composition.design, new Map([...mapped].map(([id, asset]) => [id, asset.id])), elementIds)
    const restored = composeDesign(imported)
    if (!validProject(restored)) throw new Error('The imported template contains invalid element references.')
    this.queue(restored, [...mapped.values()])
    return imported.id
  }

  create(): string | null {
    if (!this.snapshot.loaded) return null
    const project = createProject(pcTemplate)
    this.queue(project)
    return project.id
  }

  createSteam(format?: Format): string | null {
    if (!this.snapshot.loaded) return null
    const project = createSteamProject(format)
    this.queue(project)
    return project.id
  }

  updateDesign(id: string, design: CoverDesign, assets: Asset[] = [], group?: string, refreshEditor = true): void {
    const project = this.snapshot.projects.find((current) => current.id === id)
    if (!project?.composition.design) return
    const next = composeDesign({ ...project, composition: { ...project.composition, design: structuredClone(design) } })
    if (!validProject(next)) throw new Error('The template contains invalid fields or layout values.')
    if (JSON.stringify(project.composition) === JSON.stringify(next.composition) && !assets.length) return
    this.record(project, group)
    if (refreshEditor) this.histories.get(id)!.revision += 1
    this.queue({ ...next, updatedAt: new Date().toISOString() }, assets)
  }

  changeFormat(id: string, format: Format): void {
    const project = this.snapshot.projects.find((current) => current.id === id)
    if (!project || JSON.stringify(format) === JSON.stringify(project.composition.format)) return
    const next = composeDesign({ ...project, composition: { ...project.composition, format: structuredClone(format),
      elements: project.composition.design ? project.composition.elements : project.composition.elements.map((element) => adaptElement(element, placementOf(element, project.composition.format), format)) } })
    if (!validProject(next)) throw new Error('This format is invalid.')
    this.record(project)
    this.histories.get(id)!.revision += 1
    this.queue({ ...next, updatedAt: new Date().toISOString() })
  }

  duplicate(id: string): void {
    const original = this.snapshot.projects.find((project) => project.id === id)
    if (original) this.queue(duplicateProject(original))
  }

  deleteProject(id: string): void {
    if (!this.snapshot.loaded || !this.snapshot.projects.some((project) => project.id === id)) return
    this.pendingProjects.delete(id)
    this.pendingDeletions.add(id)
    this.histories.delete(id)
    const history = { ...this.snapshot.history }
    delete history[id]
    this.publish({ projects: this.snapshot.projects.filter((project) => project.id !== id), history,
      status: this.saving ? 'saving' : 'pending', error: null })
    this.scheduleSave()
  }

  rename(id: string, name: string): void {
    const project = this.snapshot.projects.find((current) => current.id === id)
    if (project && project.name !== name) {
      this.record(project, 'name')
      this.queue({ ...project, name, updatedAt: new Date().toISOString() })
    }
  }

  changeElements(id: string, elements: Element[], asset?: Asset, group?: string): void {
    const project = this.snapshot.projects.find((current) => current.id === id)
    if (!project) return
    if (JSON.stringify(project.composition.elements) === JSON.stringify(elements) && !asset) return
    this.record(project, group)
    const changed = captureDesignEdits(project, structuredClone(elements))
    this.queue({ ...changed, updatedAt: new Date().toISOString() }, asset ? [asset] : [])
  }

  hasUnsavedChanges = (): boolean => this.pendingProjects.size > 0 || this.pendingAssets.size > 0 || this.pendingDeletions.size > 0

  flush = (): Promise<void> => {
    clearTimeout(this.timer)
    this.timer = undefined
    return this.startSave(true)
  }

  private startSave(force: boolean): Promise<void> {
    // Explicit flushes (retry, page hidden, closing) also drain newer edits.
    // Autosave writes one batch so in-flight edits keep their own debounce.
    if (force) this.forceSave = true
    if (this.saving) return this.saving
    if (!this.hasUnsavedChanges()) { this.forceSave = false; return Promise.resolve() }
    this.publish({ status: 'saving', error: null })
    this.saving = this.savePending().finally(() => {
      this.saving = undefined
      this.forceSave = false
      if (this.hasUnsavedChanges() && !this.timer && this.snapshot.status !== 'error') this.scheduleSave()
    })
    return this.saving
  }

  private async savePending(): Promise<void> {
    while (this.hasUnsavedChanges()) {
      const projects = [...this.pendingProjects.values()]
      const assets = [...this.pendingAssets.values()]
      const deletedProjectIds = [...this.pendingDeletions]
      try {
        if (deletedProjectIds.length) await this.repository.save(projects, assets, deletedProjectIds)
        else await this.repository.save(projects, assets)
      } catch (error) {
        clearTimeout(this.timer)
        this.timer = undefined
        this.publish({ status: 'error', error: storageError(error, false) })
        return
      }
      for (const project of projects) {
        if (this.pendingProjects.get(project.id) === project) this.pendingProjects.delete(project.id)
      }
      for (const asset of assets) {
        if (this.pendingAssets.get(asset.id) === asset) this.pendingAssets.delete(asset.id)
      }
      for (const id of deletedProjectIds) this.pendingDeletions.delete(id)
      if (!this.forceSave) break
    }
    this.publish({ status: this.hasUnsavedChanges() ? 'pending' : 'saved', error: null })
  }

  retry = (): Promise<void> => this.snapshot.loaded ? this.flush() : this.load()

  async refreshRepository(repository: WorkspaceRepository): Promise<void> {
    // Preserve the open project, history and pending writes during development
    // updates, but let retries use the latest persistence implementation.
    if (this.saving) await this.saving
    this.repository = repository
    await this.retry()
  }
}

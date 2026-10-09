import { createProject, duplicateProject, pcTemplate } from '../domain/projects'
import type { Asset, Element, Project } from '../domain/types'
import { validAsset, validProject } from '../domain/validation'
import type { WorkspaceData, WorkspaceRepository } from './workspaceRepository'

export type SaveStatus = 'loading' | 'saving' | 'saved' | 'error'
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
    return 'This library was saved with a newer version of Shelver. Update the app before opening it.'
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
  private timer: ReturnType<typeof setTimeout> | undefined
  private loading: Promise<void> | undefined
  private saving: Promise<void> | undefined
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
      this.publish({ ...data, loaded: true, status: 'saved', error: null })
    }).catch((error: unknown) => {
      this.publish({ status: 'error', error: storageError(error, true) })
    }).finally(() => { this.loading = undefined })
    return this.loading
  }

  private queue(project: Project, assets: Asset[] = []): void {
    this.pendingProjects.set(project.id, project)
    for (const asset of assets) this.pendingAssets.set(asset.id, asset)
    const exists = this.snapshot.projects.some((current) => current.id === project.id)
    const projects = exists
      ? this.snapshot.projects.map((current) => current.id === project.id ? project : current)
      : [project, ...this.snapshot.projects]
    this.publish({
      projects, assets: assets.length ? { ...this.snapshot.assets, ...Object.fromEntries(assets.map((asset) => [asset.id, asset])) } : this.snapshot.assets,
      history: { ...this.snapshot.history, [project.id]: this.historyState(project.id) },
      status: 'saving', error: null,
    })
    clearTimeout(this.timer)
    this.timer = setTimeout(() => { void this.flush() }, 300)
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
    if (incoming.size !== assets.length || project.composition.elements.some((element) => element.type === 'image' && !incoming.has(element.assetId))) throw new Error('The imported project is missing artwork or has duplicate assets.')
    const mapped = new Map(assets.map((asset) => [asset.id, { ...asset, id: crypto.randomUUID() }]))
    const imported = structuredClone(project)
    imported.id = crypto.randomUUID()
    imported.createdAt = imported.updatedAt = new Date().toISOString()
    if (this.snapshot.projects.some((current) => current.name === imported.name)) imported.name += ' (imported)'
    imported.composition.elements = imported.composition.elements.map((element) => ({
      ...element, id: crypto.randomUUID(),
      ...(element.type === 'image' ? { assetId: mapped.get(element.assetId)!.id } : {}),
    }))
    this.queue(imported, [...mapped.values()])
    return imported.id
  }

  create(): string | null {
    if (!this.snapshot.loaded) return null
    const project = createProject(pcTemplate)
    this.queue(project)
    return project.id
  }

  duplicate(id: string): void {
    const original = this.snapshot.projects.find((project) => project.id === id)
    if (original) this.queue(duplicateProject(original))
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
    this.queue({ ...project, composition: { ...project.composition, elements: structuredClone(elements) }, updatedAt: new Date().toISOString() }, asset ? [asset] : [])
  }

  hasUnsavedChanges = (): boolean => this.pendingProjects.size > 0 || this.pendingAssets.size > 0

  flush = (): Promise<void> => {
    clearTimeout(this.timer)
    this.timer = undefined
    if (this.saving) return this.saving
    if (!this.hasUnsavedChanges()) return Promise.resolve()
    this.publish({ status: 'saving', error: null })
    this.saving = this.savePending().finally(() => { this.saving = undefined })
    return this.saving
  }

  private async savePending(): Promise<void> {
    while (this.hasUnsavedChanges()) {
      const projects = [...this.pendingProjects.values()]
      const assets = [...this.pendingAssets.values()]
      try {
        await this.repository.save(projects, assets)
      } catch (error) {
        this.publish({ status: 'error', error: storageError(error, false) })
        return
      }
      for (const project of projects) {
        if (this.pendingProjects.get(project.id) === project) this.pendingProjects.delete(project.id)
      }
      for (const asset of assets) {
        if (this.pendingAssets.get(asset.id) === asset) this.pendingAssets.delete(asset.id)
      }
    }
    this.publish({ status: 'saved', error: null })
  }

  retry = (): Promise<void> => this.snapshot.loaded ? this.flush() : this.load()
}

import { validAsset, validProject } from '../domain/validation'
import type { Asset, Project } from '../domain/types'

const DATABASE_VERSION = 1
const DATABASE_NAME = 'shelver'

export type WorkspaceData = { projects: Project[]; assets: Record<string, Asset> }
export interface WorkspaceRepository {
  load(): Promise<WorkspaceData>
  save(projects: Project[], assets: Asset[]): Promise<void>
}

export class IndexedDbWorkspaceRepository implements WorkspaceRepository {
  private connection: Promise<IDBDatabase> | undefined
  private database: IDBDatabase | undefined
  private name: string
  private factory: IDBFactory | undefined

  constructor(name = DATABASE_NAME, factory = globalThis.indexedDB) {
    this.name = name
    this.factory = factory
  }

  private open(): Promise<IDBDatabase> {
    if (this.connection) return this.connection
    if (!this.factory) return Promise.reject(new Error('Local storage is unavailable in this browser.'))
    const factory = this.factory
    this.connection = new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(this.name, DATABASE_VERSION)
      let blocked = false
      request.onupgradeneeded = (event) => {
        // Version 1 introduces both stores. Future migrations belong here.
        if (event.oldVersion < 1) {
          request.result.createObjectStore('projects', { keyPath: 'id' })
          request.result.createObjectStore('assets', { keyPath: 'id' })
        }
      }
      request.onblocked = () => {
        blocked = true
        reject(new Error('Close other Shelver tabs and retry to open local storage.'))
      }
      request.onerror = () => reject(request.error ?? new Error('Unable to open local storage.'))
      request.onsuccess = () => {
        const database = request.result
        if (blocked) { database.close(); return }
        this.database = database
        database.onversionchange = () => this.close()
        database.onclose = () => { this.database = undefined; this.connection = undefined }
        resolve(database)
      }
    }).catch((error: unknown) => {
      this.connection = undefined
      throw error
    })
    return this.connection
  }

  async load(): Promise<WorkspaceData> {
    const database = await this.open()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(['projects', 'assets'], 'readonly')
      const projectsRequest = transaction.objectStore('projects').getAll()
      const assetsRequest = transaction.objectStore('assets').getAll()
      transaction.onabort = () => reject(transaction.error ?? new Error('Unable to read local projects.'))
      transaction.oncomplete = () => {
        const projects: unknown[] = projectsRequest.result
        const assets: unknown[] = assetsRequest.result
        if (!projects.every(validProject) || !assets.every(validAsset)) {
          reject(new Error('Local data is invalid or uses an unsupported version. Existing data has been left untouched.'))
          return
        }
        const assetMap = Object.fromEntries(assets.map((asset) => [asset.id, asset]))
        for (const project of projects) {
          if (project.composition.elements.some((element) => element.type === 'image' && !Object.hasOwn(assetMap, element.assetId))) {
            reject(new Error(`Artwork is missing from “${project.name}”. Existing data has been left untouched.`))
            return
          }
        }
        resolve({ projects: projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), assets: assetMap })
      }
    })
  }

  async save(projects: Project[], assets: Asset[]): Promise<void> {
    const database = await this.open()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(['projects', 'assets'], 'readwrite')
      // Request success is not enough: report saved only after the entire transaction commits.
      transaction.oncomplete = () => resolve()
      transaction.onabort = () => reject(transaction.error ?? new Error('Local saving was interrupted.'))
      try {
        for (const asset of assets) transaction.objectStore('assets').add(asset)
        for (const project of projects) transaction.objectStore('projects').put(project)
      } catch (error) {
        transaction.abort()
        reject(error)
      }
    })
  }

  close(): void {
    this.database?.close()
    this.database = undefined
    this.connection = undefined
  }
}

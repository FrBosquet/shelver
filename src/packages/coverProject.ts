import { strFromU8, strToU8, unzip, unzipSync, zip } from 'fflate'
import type { AsyncZippable, Unzipped } from 'fflate'
import { SCHEMA_VERSION } from '../domain/types'
import type { Asset, PackageAsset, Project, ProjectPackage } from '../domain/types'
import { isRecord, validAsset, validProject } from '../domain/validation'

export const PACKAGE_LIMITS = { archive: 100 * 1024 * 1024, expanded: 200 * 1024 * 1024, manifest: 2 * 1024 * 1024, assets: 256 }
const extensions: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

async function digest(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return [...hash].map((value) => value.toString(16).padStart(2, '0')).join('')
}

function checkSignature(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === 'image/png') return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
  if (mimeType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
  return mimeType === 'image/webp' && bytes.length >= 12 && strFromU8(bytes.subarray(0, 4)) === 'RIFF' && strFromU8(bytes.subarray(8, 12)) === 'WEBP'
}

async function checkImage(asset: Asset): Promise<void> {
  // Decode one image at a time, and release its pixels before checking the next.
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(asset.blob)
    try {
      if (bitmap.width !== asset.width || bitmap.height !== asset.height) throw new Error(`Image dimensions do not match: ${asset.name}`)
    } finally { bitmap.close() }
  } else if (typeof Image !== 'undefined') {
    const url = URL.createObjectURL(asset.blob)
    try {
      await new Promise<void>((resolve, reject) => {
        const image = new Image()
        image.onload = () => image.naturalWidth === asset.width && image.naturalHeight === asset.height
          ? resolve() : reject(new Error(`Image dimensions do not match: ${asset.name}`))
        image.onerror = () => reject(new Error(`Unable to open artwork: ${asset.name}`))
        image.src = url
      })
    } finally { URL.revokeObjectURL(url) }
  }
}

export async function exportCoverProject(project: Project, assets: Record<string, Asset>): Promise<Blob> {
  const snapshot = structuredClone(project)
  if (!validProject(snapshot)) throw new Error('This project cannot be exported because its composition is invalid.')
  if (snapshot.composition.format.unit !== 'px') throw new Error('This build only supports digital canvas dimensions.')
  const ids = [...new Set(snapshot.composition.elements.flatMap((element) => element.type === 'image' ? [element.assetId] : []))]
  if (ids.length > PACKAGE_LIMITS.assets) throw new Error('A project package can contain up to 256 images.')
  const files: AsyncZippable = {}
  const packaged: PackageAsset[] = []
  let total = 0
  for (const [index, id] of ids.entries()) {
    const asset = Object.hasOwn(assets, id) ? assets[id] : undefined
    if (!validAsset(asset) || !Object.hasOwn(extensions, asset.mimeType)) throw new Error(`Missing or unsupported artwork: ${id}`)
    total += asset.blob.size
    if (total > PACKAGE_LIMITS.archive) throw new Error('This project is too large for a 100 MiB package.')
    const bytes = new Uint8Array(await asset.blob.arrayBuffer())
    if (!checkSignature(bytes, asset.mimeType)) throw new Error(`Invalid artwork: ${asset.name}`)
    const path = `assets/${index}.${extensions[asset.mimeType]}`
    files[path] = [bytes, { level: 0 }]
    const descriptor = { id: asset.id, name: asset.name, mimeType: asset.mimeType, width: asset.width, height: asset.height, path, size: bytes.length, sha256: await digest(bytes) }
    if (!validDescriptor(descriptor)) throw new Error(`Artwork exceeds the supported dimensions: ${asset.name}`)
    packaged.push(descriptor)
  }
  const manifest: ProjectPackage = { type: 'shelver-project', schemaVersion: SCHEMA_VERSION, project: snapshot, assets: packaged }
  const manifestBytes = strToU8(JSON.stringify(manifest))
  if (manifestBytes.length > PACKAGE_LIMITS.manifest) throw new Error('The project manifest exceeds 2 MiB.')
  files['manifest.json'] = manifestBytes
  const bytes = await new Promise<Uint8Array<ArrayBuffer>>((resolve, reject) => {
    zip(files, { level: 6 }, (error, result) => error ? reject(error) : resolve(result))
  })
  if (bytes.length > PACKAGE_LIMITS.archive) throw new Error('This project is too large for a 100 MiB package.')
  return new Blob([bytes], { type: 'application/zip' })
}

function unpack(bytes: Uint8Array): Promise<Unzipped> {
  const paths = new Set<string>()
  let total = 0
  let issue: string | null = null
  // Inspect the directory and reject excessive or duplicate entries before expanding any data.
  unzipSync(bytes, { filter: (file) => {
    total += file.originalSize
    if (paths.has(file.name)) issue = 'The package contains duplicate files.'
    paths.add(file.name)
    if (file.name !== 'manifest.json' && !/^assets\/\d+\.(png|jpg|webp)$/.test(file.name)) issue = 'The package contains an unsupported file path.'
    if (paths.size > PACKAGE_LIMITS.assets + 1 || total > PACKAGE_LIMITS.expanded) issue = 'The package exceeds the import limits.'
    if (file.name === 'manifest.json' && file.originalSize > PACKAGE_LIMITS.manifest) issue = 'The project manifest exceeds 2 MiB.'
    return false
  } })
  if (issue) throw new Error(issue)
  if (!paths.has('manifest.json')) throw new Error('The package is missing manifest.json.')
  return new Promise((resolve, reject) => {
    unzip(bytes, (error, result) => error ? reject(new Error('The ZIP package could not be opened.')) : resolve(result))
  })
}

function validDescriptor(value: unknown): value is PackageAsset {
  return isRecord(value) && typeof value.id === 'string' && Boolean(value.id) && typeof value.name === 'string'
    && typeof value.mimeType === 'string' && Object.hasOwn(extensions, value.mimeType)
    && typeof value.width === 'number' && Number.isInteger(value.width) && value.width > 0 && value.width <= 16000
    && typeof value.height === 'number' && Number.isInteger(value.height) && value.height > 0 && value.height <= 16000
    && value.width * value.height <= 64_000_000
    && typeof value.size === 'number' && Number.isInteger(value.size) && value.size > 0 && value.size <= PACKAGE_LIMITS.expanded
    && typeof value.path === 'string' && /^assets\/\d+\.(png|jpg|webp)$/.test(value.path)
    && typeof value.sha256 === 'string' && /^[0-9a-f]{64}$/.test(value.sha256)
}

export async function importCoverProject(file: Blob): Promise<{ project: Project; assets: Asset[] }> {
  if (file.size > PACKAGE_LIMITS.archive) throw new Error('Project packages must be no larger than 100 MiB.')
  let files: Unzipped
  try { files = await unpack(new Uint8Array(await file.arrayBuffer())) }
  catch (error) { throw new Error(error instanceof Error ? error.message : 'The ZIP package could not be opened.', { cause: error }) }
  let manifest: unknown
  try { manifest = JSON.parse(strFromU8(files['manifest.json'])) }
  catch { throw new Error('The project manifest is not valid JSON.') }
  if (!isRecord(manifest) || manifest.type !== 'shelver-project') throw new Error('This is not a Shelver project package.')
  if (manifest.schemaVersion !== SCHEMA_VERSION) throw new Error('This project package uses an unsupported version.')
  if (!validProject(manifest.project) || !Array.isArray(manifest.assets) || !manifest.assets.every(validDescriptor)) throw new Error('The project manifest contains invalid composition or artwork data.')
  if (manifest.project.composition.format.unit !== 'px') throw new Error('This build only supports digital canvas dimensions.')
  const assets: Asset[] = []
  const ids = new Set<string>()
  const paths = new Set(['manifest.json'])
  for (const descriptor of manifest.assets) {
    if (ids.has(descriptor.id) || paths.has(descriptor.path)) throw new Error('The manifest contains duplicate artwork entries.')
    ids.add(descriptor.id)
    paths.add(descriptor.path)
    const bytes = Object.hasOwn(files, descriptor.path) ? files[descriptor.path] : undefined
    if (!bytes || bytes.length !== descriptor.size || await digest(bytes) !== descriptor.sha256 || !checkSignature(bytes, descriptor.mimeType)) throw new Error(`Artwork is missing or damaged: ${descriptor.name}`)
    const { id, name, mimeType, width, height } = descriptor
    const asset: Asset = { id, name, mimeType, width, height, blob: new Blob([bytes], { type: mimeType }) }
    await checkImage(asset)
    assets.push(asset)
  }
  if (Object.keys(files).some((path) => !paths.has(path))) throw new Error('The package contains files not listed in its manifest.')
  const referenced = new Set(manifest.project.composition.elements.flatMap((element) => element.type === 'image' ? [element.assetId] : []))
  if ([...referenced].some((id) => !ids.has(id))) throw new Error('The package is missing artwork required by this cover.')
  if ([...ids].some((id) => !referenced.has(id))) throw new Error('The package contains artwork not used by this cover.')
  return { project: manifest.project, assets }
}

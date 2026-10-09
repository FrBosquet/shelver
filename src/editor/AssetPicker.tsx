import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Asset, Project } from '../domain/types'
import { imageDimensions } from '../assets/imageDimensions'
import { referencedAssetIds } from '../domain/composition'

function AssetPreview({ asset }: { asset: Asset }) {
  const image = useRef<HTMLImageElement>(null)
  useEffect(() => {
    const next = URL.createObjectURL(asset.blob)
    if (image.current) image.current.src = next
    return () => URL.revokeObjectURL(next)
  }, [asset.blob])
  return <img ref={image} alt="" />
}

type Props = {
  project: Project
  assets: Record<string, Asset>
  title?: string
  onUpload: (assets: Asset[]) => void
  onSelect: (asset: Asset) => void
  onClose: () => void
}

export function AssetPicker({ project, assets, title = 'Select image', onUpload, onSelect, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<'project' | 'local'>('project')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploaded, setUploaded] = useState<Asset[]>([])
  useEffect(() => {
    const node = dialog.current!
    node.showModal()
    return () => node.close()
  }, [])
  const library = { ...assets, ...Object.fromEntries(uploaded.map((asset) => [asset.id, asset])) }
  const projectIds = new Set([...referencedAssetIds(project), ...uploaded.map((asset) => asset.id)])
  const visible = Object.values(library).filter((asset) => (tab === 'local' || projectIds.has(asset.id)) && asset.name.toLowerCase().includes(query.toLowerCase()))

  async function upload(files: File[]) {
    if (busy || !files.length) return
    setBusy(true); setError(null)
    const accepted: Asset[] = [], failures: string[] = []
    for (const file of files) {
      try {
        const mimeType = file.type || (/\.svg$/i.test(file.name) ? 'image/svg+xml' : '')
        if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(mimeType) || file.size > 100 * 1024 * 1024) throw new Error('Use PNG, JPEG, WebP or SVG below 100 MiB.')
        const blob = mimeType === file.type ? file : new Blob([file], { type: mimeType })
        const { width, height } = await imageDimensions(blob)
        if (width > 16000 || height > 16000 || width * height > 64_000_000) throw new Error('Maximum size: 16,000 px per side and 64 megapixels.')
        accepted.push({ id: crypto.randomUUID(), name: file.name, blob, mimeType, width, height })
      } catch (cause) { failures.push(`${file.name}: ${cause instanceof Error ? cause.message : 'Unable to open image.'}`) }
    }
    try {
      if (accepted.length) { onUpload(accepted); setUploaded((current) => [...current, ...accepted]) }
      if (failures.length) setError(failures.join(' '))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save images.') }
    finally { setBusy(false); setDragging(false) }
  }

  return createPortal(<dialog ref={dialog} className="asset-picker" aria-labelledby="asset-picker-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}>
    <div className="section-heading"><div><p className="eyebrow">ASSET LIBRARY</p><h2 id="asset-picker-title">{title}</h2></div><button disabled={busy} onClick={onClose} aria-label="Close asset picker">Close</button></div>
    <div className="inspector-tabs" role="tablist" aria-label="Asset libraries">{(['project', 'local'] as const).map((value) => <button key={value} id={`asset-tab-${value}`} role="tab" aria-selected={tab === value} aria-controls="asset-panel" onClick={() => setTab(value)}>{value === 'project' ? 'Project assets' : 'All local assets'}</button>)}</div>
    <section id="asset-panel" role="tabpanel" aria-labelledby={`asset-tab-${tab}`}>
      {tab === 'project' && <div className="asset-dropzone" data-dragging={dragging} onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false) }} onDrop={(event) => { event.preventDefault(); void upload(Array.from(event.dataTransfer.files)) }}>
        <strong>{busy ? 'Uploading images…' : 'Drop images here to upload'}</strong><span className="small muted">PNG, JPEG, WebP, SVG · Upload several images at once</span><button disabled={busy} onClick={() => input.current?.click()}>Upload assets</button>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg" multiple hidden onChange={(event) => { void upload(Array.from(event.target.files ?? [])); event.target.value = '' }} />
      </div>}
      <label className="field asset-search">Search assets<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by filename…" /></label>
      {error && <p className="error" role="alert">{error}</p>}
      {busy && <p role="status">Saving artwork to your project…</p>}
      <div className="asset-picker-grid">{visible.map((asset) => <button key={asset.id} disabled={busy} onClick={() => onSelect(asset)} className="asset-card" title={asset.name}>
        <span className="asset-thumbnail"><AssetPreview asset={asset} /></span><strong>{asset.name}</strong><span className="small muted">{asset.width} × {asset.height}</span>
      </button>)}</div>
      {!visible.length && <p className="asset-empty">{query ? 'No assets match your search.' : tab === 'project' ? 'No project assets yet. Drop images above to get started.' : 'Your local asset library is empty.'}</p>}
    </section>
  </dialog>, document.body)
}

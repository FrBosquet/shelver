import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Asset } from '../domain/types'

type Crop = { x: number; y: number; width: number; height: number }
type Props = { asset: Asset; onApply: (asset: Asset) => Promise<void>; onClose: () => void }

export function ImageCropModal({ asset, onApply, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const image = useRef<HTMLImageElement>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const full = { x: 0, y: 0, width: asset.width, height: asset.height }
  const [crop, setCrop] = useState<Crop>(full)
  useEffect(() => {
    const node = dialog.current!
    const url = URL.createObjectURL(asset.blob)
    image.current!.src = url
    node.showModal()
    return () => { node.close(); URL.revokeObjectURL(url) }
  }, [asset.blob])

  async function apply() {
    setBusy(true); setError(null)
    try {
      if (crop.x === 0 && crop.y === 0 && crop.width === asset.width && crop.height === asset.height) { await onApply(asset); return }
      const output = document.createElement('canvas')
      output.width = crop.width; output.height = crop.height
      const context = output.getContext('2d')
      if (!context || !image.current) throw new Error('Unable to crop this image.')
      context.drawImage(image.current, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height)
      const blob = await new Promise<Blob>((resolve, reject) => output.toBlob((value) => value ? resolve(value) : reject(new Error('Unable to save crop.')), 'image/png'))
      await onApply({ id: crypto.randomUUID(), name: `${asset.name.replace(/\.[^.]+$/, '')} (crop).png`, mimeType: 'image/png', blob, width: crop.width, height: crop.height })
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to apply crop.'); setBusy(false) }
  }

  return createPortal(<dialog ref={dialog} className="asset-picker crop-modal" aria-labelledby="crop-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}>
    <div className="section-heading"><h2 id="crop-title">Crop image</h2><button disabled={busy} onClick={onClose}>Cancel</button></div>
    <p className="small muted">Drag on the image to select a rectangle, or adjust the pixel values below. The original stays in your library.</p>
    <div className="crop-stage" aria-label="Draw crop rectangle" onPointerDown={(event) => {
      if (!loaded || busy) return
      const bounds = event.currentTarget.getBoundingClientRect()
      start.current = { x: Math.min(asset.width - 1, Math.max(0, Math.round((event.clientX - bounds.left) / bounds.width * asset.width))), y: Math.min(asset.height - 1, Math.max(0, Math.round((event.clientY - bounds.top) / bounds.height * asset.height))) }
      event.currentTarget.setPointerCapture(event.pointerId)
    }} onPointerMove={(event) => {
      if (!start.current) return
      const bounds = event.currentTarget.getBoundingClientRect()
      const x = Math.max(0, Math.min(asset.width, Math.round((event.clientX - bounds.left) / bounds.width * asset.width)))
      const y = Math.max(0, Math.min(asset.height, Math.round((event.clientY - bounds.top) / bounds.height * asset.height)))
      setCrop({ x: Math.min(x, start.current.x), y: Math.min(y, start.current.y), width: Math.max(1, Math.abs(x - start.current.x)), height: Math.max(1, Math.abs(y - start.current.y)) })
    }} onPointerUp={() => { start.current = null }} onPointerCancel={() => { start.current = null }}>
      <img ref={image} alt={asset.name} draggable={false} onLoad={() => setLoaded(true)} onError={() => setError('Unable to open this image.')} />
      {loaded && <div className="crop-rectangle" style={{ left: `${crop.x / asset.width * 100}%`, top: `${crop.y / asset.height * 100}%`, width: `${crop.width / asset.width * 100}%`, height: `${crop.height / asset.height * 100}%` }} />}
    </div>
    <div className="crop-fields">{(['x', 'y', 'width', 'height'] as const).map((key) => <label className="field" key={key}>{key === 'x' || key === 'y' ? key.toUpperCase() : key === 'width' ? 'Width' : 'Height'} (px)<input type="number" disabled={busy} min={key === 'x' || key === 'y' ? 0 : 1} max={key === 'x' ? asset.width - 1 : key === 'y' ? asset.height - 1 : key === 'width' ? asset.width - crop.x : asset.height - crop.y} value={crop[key]} onChange={(event) => {
      const value = event.target.valueAsNumber
      if (!Number.isFinite(value)) return
      setCrop((current) => {
        const next = { ...current, [key]: Math.round(Math.max(key === 'x' || key === 'y' ? 0 : 1, value)) }
        next.x = Math.min(next.x, asset.width - 1); next.y = Math.min(next.y, asset.height - 1)
        next.width = Math.min(next.width, asset.width - next.x); next.height = Math.min(next.height, asset.height - next.y)
        return next
      })
    }} /></label>)}</div>
    {error && <p role="alert" className="error">{error}</p>}
    <div className="crop-actions"><button disabled={busy} onClick={() => setCrop(full)}>Reset rectangle</button><button disabled={!loaded || busy} onClick={() => void apply()}>{busy ? 'Applying…' : 'Apply crop'}</button></div>
  </dialog>, document.body)
}

import { useEffect, useRef, useState } from 'react'
import { Canvas, FabricImage, Textbox } from 'fabric'
import type { FabricObject } from 'fabric'
import { createText } from '../domain/projects'
import type { Asset, Element, Project } from '../domain/types'
import { readElement, renderElement } from './fabricAdapter'

type Props = {
  project: Project
  assets: Record<string, Asset>
  onChange: (elements: Element[], asset?: Asset) => void
}

export function Editor({ project, assets, onChange }: Props) {
  const canvasElement = useRef<HTMLCanvasElement>(null)
  const workspace = useRef<HTMLDivElement>(null)
  const canvas = useRef<Canvas | null>(null)
  const records = useRef(new Map<FabricObject, Element>())
  const initial = useRef({ project, assets })
  const changeHandler = useRef(onChange)
  const input = useRef<HTMLInputElement>(null)
  const mounted = useRef(false)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedText, setSelectedText] = useState<string | null>(null)
  const [hasSelection, setHasSelection] = useState(false)
  const [zoom, setZoom] = useState(0.6)
  const [exported, setExported] = useState<{ url: string; filename: string } | null>(null)
  const { format } = project.composition

  useEffect(() => { changeHandler.current = onChange }, [onChange])

  function sync(instance: Canvas, asset?: Asset) {
    const elements = instance.getObjects().flatMap((object) => {
      const original = records.current.get(object)
      return original ? [readElement(object, original)] : []
    })
    changeHandler.current(elements, asset)
  }

  useEffect(() => {
    const node = canvasElement.current
    if (!node) return
    mounted.current = true
    const elementRecords = records.current
    const controller = new AbortController()
    const { project: startingProject, assets: startingAssets } = initial.current
    const { format: startingFormat, background, elements } = startingProject.composition
    const availableWidth = (workspace.current?.clientWidth ?? 780) - 60
    const initialZoom = [0.6, 0.4, 0.3, 0.2].find((value) => startingFormat.width * value <= availableWidth) ?? 0.2
    const instance = new Canvas(node, {
      width: startingFormat.width * initialZoom, height: startingFormat.height * initialZoom,
      backgroundColor: background, preserveObjectStacking: true,
      selection: false, selectionKey: [],
    })
    instance.setZoom(initialZoom)
    canvas.current = instance
    const updateSelection = () => {
      const active = instance.getActiveObject()
      setHasSelection(Boolean(active))
      setSelectedText(active instanceof Textbox ? active.text : null)
    }
    instance.on('selection:created', updateSelection)
    instance.on('selection:updated', updateSelection)
    instance.on('selection:cleared', updateSelection)
    instance.on('object:modified', () => sync(instance))
    instance.on('text:changed', () => { updateSelection(); sync(instance) })
    void Promise.all(elements.map(async (element) => ({
      element, object: await renderElement(element, startingAssets, controller.signal),
    }))).then((items) => {
      if (controller.signal.aborted) return
      for (const { object, element } of items) {
        elementRecords.set(object, element)
        instance.add(object)
      }
      instance.requestRenderAll()
      setZoom(initialZoom)
      setReady(true)
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load this cover.')
    })
    return () => {
      mounted.current = false
      controller.abort()
      canvas.current = null
      elementRecords.clear()
      void instance.dispose()
    }
  }, [])

  function setCanvasZoom(value: number) {
    const instance = canvas.current
    if (!instance) return
    instance.setDimensions({ width: format.width * value, height: format.height * value })
    instance.setZoom(value)
    setZoom(value)
  }

  async function addText() {
    const instance = canvas.current
    if (!instance || !ready) return
    const element = createText('New text')
    const object = await renderElement(element, {}, new AbortController().signal)
    if (canvas.current !== instance) return
    records.current.set(object, element)
    instance.add(object)
    instance.setActiveObject(object)
    instance.requestRenderAll()
    sync(instance)
  }

  async function importImage(file: File) {
    const instance = canvas.current
    if (!instance || !ready) return
    setBusy(true)
    setError(null)
    const url = URL.createObjectURL(file)
    try {
      const object = await FabricImage.fromURL(url)
      if (canvas.current !== instance) return
      const asset: Asset = {
        id: crypto.randomUUID(), blob: file, name: file.name,
        mimeType: file.type, width: object.width, height: object.height,
      }
      const scale = Math.min(460 / object.width, 560 / object.height, 1)
      const element: Element = {
        id: crypto.randomUUID(), name: file.name, type: 'image', assetId: asset.id,
        x: 685, y: 100, width: object.width, height: object.height,
        scaleX: scale, scaleY: scale, rotation: 0, opacity: 1, visible: true, locked: false,
      }
      object.set({ originX: 'left', originY: 'top', left: element.x, top: element.y, scaleX: scale, scaleY: scale })
      records.current.set(object, element)
      instance.add(object)
      instance.setActiveObject(object)
      instance.requestRenderAll()
      sync(instance, asset)
    } catch {
      if (mounted.current) setError('This image could not be opened. Try a PNG, JPEG, or WebP file.')
    } finally {
      URL.revokeObjectURL(url)
      if (mounted.current) setBusy(false)
    }
  }

  function editText(text: string) {
    const instance = canvas.current
    const object = instance?.getActiveObject()
    if (!instance || !(object instanceof Textbox)) return
    object.set({ text })
    object.setCoords()
    setSelectedText(text)
    instance.requestRenderAll()
    sync(instance)
  }

  function removeSelected() {
    const instance = canvas.current
    if (!instance) return
    for (const object of instance.getActiveObjects()) {
      instance.remove(object)
      records.current.delete(object)
    }
    instance.discardActiveObject()
    instance.requestRenderAll()
    sync(instance)
  }

  async function exportPng() {
    const instance = canvas.current
    if (!instance || !ready) return
    setBusy(true)
    setError(null)
    try {
      await document.fonts.ready
      if (canvas.current !== instance) return
      const link = document.createElement('a')
      link.download = `${project.name.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'cover'}.png`
      link.href = instance.toDataURL({ format: 'png', multiplier: 1 / instance.getZoom() })
      setExported({ url: link.href, filename: link.download })
      document.body.append(link)
      link.click()
      link.remove()
    } catch {
      if (mounted.current) setError('PNG export failed. Please try again.')
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  return (
    <div className="editor">
      <div className="editor-toolbar">
        <div className="toolbar-group">
          <button disabled={!ready || busy} onClick={() => input.current?.click()}>+ Artwork</button>
          <button disabled={!ready || busy} onClick={() => void addText()}>+ Text</button>
          <button disabled={!hasSelection || busy} onClick={removeSelected}>Delete</button>
        </div>
        <div className="toolbar-group">
          <label className="zoom-control">Zoom
            <select aria-label="Zoom" value={zoom} onChange={(event) => setCanvasZoom(Number(event.target.value))}>
              <option value={0.2}>20%</option><option value={0.3}>30%</option>
              <option value={0.4}>40%</option><option value={0.6}>60%</option>
              <option value={0.8}>80%</option><option value={1}>100%</option>
            </select>
          </label>
          <button className="primary" disabled={!ready || busy} onClick={() => void exportPng()}>{busy ? 'Working…' : 'Export PNG ↗'}</button>
        </div>
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => {
        const file = event.target.files?.[0]
        if (file) void importImage(file)
        event.target.value = ''
      }} />
      {error && <p className="error" role="alert">{error}</p>}
      {exported && <p className="export-result" role="status">PNG ready · {format.width} × {format.height} px. <a href={exported.url} download={exported.filename}>Save PNG</a></p>}
      <div className="editor-body">
        <div className="canvas-workspace" ref={workspace}>
          <div className="canvas-sheet" style={{ width: format.width * zoom }}>
            <div className="panel-labels">
              {format.panels.map((panel) => <span key={panel.id} style={{ width: `${panel.width / format.width * 100}%` }}>{panel.id}</span>)}
            </div>
            <div className="canvas-frame">
              <canvas ref={canvasElement} aria-label="Cover composition editor" />
              {format.panels.slice(1).map((panel) => <span className="panel-guide" key={panel.id} style={{ left: `${panel.x / format.width * 100}%` }} />)}
            </div>
          </div>
          <p className="canvas-note">Drag to position · Use handles to resize and rotate · Double-click text to edit</p>
        </div>
        <aside className="inspector">
          <p className="eyebrow">COMPOSITION</p>
          <h2>Make it yours.</h2>
          {selectedText !== null ? <label className="field">Selected text
            <textarea aria-label="Selected text" rows={7} value={selectedText} onChange={(event) => editText(event.target.value)} />
          </label> : <p className="muted">Select text to edit its content, or add your own artwork to the canvas.</p>}
          <div className="details">
            <span>Working format</span><strong>PC / Steam</strong>
            <span>Canvas</span><strong>{format.width} × {format.height} px</strong>
            <span>Panels</span><strong>Back · Spine · Front</strong>
          </div>
          <p className="small muted">Digital working dimensions. Physical case measurements will be validated before print export.</p>
        </aside>
      </div>
    </div>
  )
}

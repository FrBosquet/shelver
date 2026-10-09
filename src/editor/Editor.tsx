import { TableIconPicker } from './TableIconPicker'
import { qrMatrix } from '../domain/qr'
import { tableIcons } from '../domain/tableIcons'
import { switchElementType } from '../domain/elementTypes'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Canvas, FabricImage, Textbox } from 'fabric'
import type { FabricObject } from 'fabric'
import { createText } from '../domain/projects'
import { composeDesign } from '../domain/composition'
import type { Asset, Element, ImageFilters, Project } from '../domain/types'
import { readElement, renderElement } from './fabricAdapter'
import { AssetPicker } from './AssetPicker'
import { sharedLogos } from '../assets/logoLibrary'

type Props = {
  onUploadAssets: (assets: Asset[]) => void
  inspectorHost: HTMLDivElement | null
  selectedBlockId: string
  onSelectBlock: (id: string) => void
  project: Project
  assets: Record<string, Asset>
  onChange: (elements: Element[], asset?: Asset, group?: string) => void
  initialZoom?: number
  onZoomChange: (zoom: number) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onResetElement: (id: string) => void
}

export function Editor({ onUploadAssets, inspectorHost, selectedBlockId, onSelectBlock, project, assets, onChange, initialZoom, onZoomChange, canUndo, canRedo, onUndo, onRedo, onResetElement }: Props) {
  const canvasElement = useRef<HTMLCanvasElement>(null)
  const workspace = useRef<HTMLDivElement>(null)
  const canvas = useRef<Canvas | null>(null)
  const editRequest = useRef(0)
  const records = useRef(new Map<FabricObject, Element>())
  const initial = useRef({ project, assets, initialZoom, onZoomChange })
  const applyingSelection = useRef(false)
  const blockSelectionHandler = useRef(onSelectBlock)
  blockSelectionHandler.current = onSelectBlock
  const changeHandler = useRef(onChange)
  const [iconCell, setIconCell] = useState<{ id: string; row: number; column: number } | null>(null)
  const [showAssets, setShowAssets] = useState(false)
  const mounted = useRef(false)
  const imageTarget = useRef<Element | null>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [showLogos, setShowLogos] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedText, setSelectedText] = useState<string | null>(null)
  const [selection, setSelection] = useState<Element | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [hasSelection, setHasSelection] = useState(false)
  const [zoom, setZoom] = useState(0.6)
  const [exported, setExported] = useState<{ url: string; filename: string } | null>(null)
  const { format } = project.composition

  useEffect(() => { changeHandler.current = onChange }, [onChange])

  function sync(instance: Canvas, asset?: Asset, group?: string) {
    const elements = instance.getObjects().flatMap((object) => {
      const original = records.current.get(object)
      return original ? [readElement(object, original)] : []
    })
    setExported(null)
    changeHandler.current(elements, asset, group)
  }

  useEffect(() => {
    const node = canvasElement.current
    if (!node) return
    mounted.current = true
    const elementRecords = records.current
    const controller = new AbortController()
    const { project: startingProject, assets: startingAssets } = initial.current
    const { format: startingFormat, background, elements } = composeDesign(startingProject).composition
    const availableWidth = (workspace.current?.clientWidth ?? 780) - 60
    const initialZoom = initial.current.initialZoom ?? [0.6, 0.4, 0.3, 0.2].find((value) => startingFormat.width * value <= availableWidth) ?? 0.2
    const instance = new Canvas(node, {
      width: startingFormat.width * initialZoom, height: startingFormat.height * initialZoom,
      backgroundColor: background, preserveObjectStacking: true,
      selection: false, selectionKey: [],
    })
    instance.setZoom(initialZoom)
    canvas.current = instance
    const updateSelection = () => {
      const active = instance.getActiveObject()
      const element = active ? elementRecords.get(active) : undefined
      if (!applyingSelection.current) blockSelectionHandler.current(element?.id ?? '')
      setHasSelection(Boolean(active) && !element?.blockId)
      setSelectedText(active instanceof Textbox ? active.text : null)
      setSelection(element ?? null)
    }
    instance.on('selection:created', updateSelection)
    instance.on('selection:updated', updateSelection)
    instance.on('selection:cleared', updateSelection)
    instance.on('object:modified', () => sync(instance))
    instance.on('text:changed', () => {
      updateSelection()
      sync(instance, undefined, `text:${elementRecords.get(instance.getActiveObject()!)?.id}`)
    })
    void Promise.all(elements.map(async (element) => ({
      element, object: await renderElement(element, startingAssets, controller.signal, Boolean(startingProject.composition.design?.overrides[element.id]?.replacement)),
    }))).then((items) => {
      if (controller.signal.aborted) return
      for (const { object, element } of items) {
        elementRecords.set(object, element)
        instance.add(object)
      }
      instance.requestRenderAll()
      setWarnings(items.filter(({ object, element }) => object instanceof Textbox && element.blockId && object.height > element.height * 1.05).map(({ element }) => element.name))
      setZoom(initialZoom)
      initial.current.onZoomChange(initialZoom)
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

  useEffect(() => {
    const instance = canvas.current
    if (!instance || !ready) return
    const objects = instance.getObjects()
    const object = objects.find((item) => records.current.get(item)?.id === selectedBlockId)
      ?? objects.find((item) => { const element = records.current.get(item); return element?.blockId === selectedBlockId && element.visible && !element.locked })
    if (instance.getActiveObject() === object) return
    applyingSelection.current = true
    instance.discardActiveObject()
    if (object) instance.setActiveObject(object)
    instance.requestRenderAll()
    applyingSelection.current = false
  }, [selectedBlockId, ready])

  const deleteSelection = useEffectEvent(() => removeSelected())

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || !ready || busy) return
      if (event.target instanceof HTMLElement && (event.target.isContentEditable || event.target.closest('input, textarea, select'))) return
      const active = canvas.current?.getActiveObject()
      if (active instanceof Textbox && active.isEditing) return
      if ((event.key === 'Delete' || event.key === 'Backspace') && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
        if (!active || records.current.get(active)?.blockId) return
        event.preventDefault()
        deleteSelection()
        return
      }
      if (!(event.metaKey || event.ctrlKey)) return
      const key = event.key.toLowerCase()
      const redo = key === 'y' || (key === 'z' && event.shiftKey)
      if (key !== 'z' && key !== 'y') return
      event.preventDefault()
      if (redo ? canRedo : canUndo) (redo ? onRedo : onUndo)()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [canUndo, canRedo, onUndo, onRedo, ready, busy])

  function setCanvasZoom(value: number) {
    const instance = canvas.current
    if (!instance) return
    value = Math.min(2, Math.max(0.1, value))
    instance.setDimensions({ width: format.width * value, height: format.height * value })
    instance.setZoom(value)
    setZoom(value)
    onZoomChange(value)
  }

  const gestureZoom = useEffectEvent((value: number) => {
    if (ready && !busy) setCanvasZoom(value)
  })

  useEffect(() => {
    const node = workspace.current
    if (!node) return
    let pinch: { distance: number; zoom: number } | null = null
    const distance = (touches: TouchList) => Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY,
    )
    const wheel = (event: WheelEvent) => {
      // Trackpads report pinch gestures as Ctrl+wheel.
      if (!event.ctrlKey || !canvas.current) return
      event.preventDefault()
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? node.clientHeight : 1)
      gestureZoom(canvas.current.getZoom() * Math.exp(-delta * 0.01))
    }
    const start = (event: TouchEvent) => {
      if (event.touches.length !== 2 || !canvas.current) return
      event.preventDefault()
      event.stopPropagation()
      pinch = { distance: distance(event.touches), zoom: canvas.current.getZoom() }
      canvas.current.endCurrentTransform(event)
    }
    const move = (event: TouchEvent) => {
      if (!pinch || event.touches.length !== 2) return
      event.preventDefault()
      event.stopPropagation()
      if (pinch.distance > 0) gestureZoom(pinch.zoom * distance(event.touches) / pinch.distance)
    }
    const end = (event: TouchEvent) => {
      if (!pinch) return
      event.stopPropagation()
      if (event.touches.length < 2) pinch = null
    }
    node.addEventListener('wheel', wheel, { passive: false })
    node.addEventListener('touchstart', start, { passive: false, capture: true })
    node.addEventListener('touchmove', move, { passive: false, capture: true })
    node.addEventListener('touchend', end, true)
    node.addEventListener('touchcancel', end, true)
    return () => {
      node.removeEventListener('wheel', wheel)
      node.removeEventListener('touchstart', start, true)
      node.removeEventListener('touchmove', move, true)
      node.removeEventListener('touchend', end, true)
      node.removeEventListener('touchcancel', end, true)
    }
  }, [])

  async function addElement(elementType: Element['type']) {
    if (elementType === 'image') { imageTarget.current = null; setShowAssets(true); return }
    const instance = canvas.current
    if (!instance || !ready) return
    const front = format.panels.find((panel) => panel.id === 'front') ?? format.panels[0]
    const base = { ...createText('New text'), x: front.x + front.width * 0.08, y: format.height * 0.15, width: front.width * 0.7 }
    let element: Element = base
    if (elementType === 'shape') element = { ...base, type: 'shape', name: 'Box', height: format.height * 0.2, fill: '#c2e3b5' }
    if (elementType === 'table') element = { ...base, type: 'table', name: 'Table', height: format.height * 0.25, cells: [['Heading', 'Value'], ['Item', 'Description'], ['Item', 'Description']], fill: '#ffffff', textColor: '#172129', fontSize: 18 }
    if (elementType === 'qr') element = { ...base, type: 'qr', name: 'QR code', width: 150, height: 150, url: 'https://store.steampowered.com/' }
    if (elementType === 'rating') element = { ...base, type: 'rating', name: 'PEGI', width: 100, height: 125, rating: '12' }
    const object = await renderElement(element, {}, new AbortController().signal)
    if (canvas.current !== instance) return
    records.current.set(object, element)
    instance.add(object)
    instance.setActiveObject(object)
    instance.requestRenderAll()
    sync(instance)
  }

  async function addLogo(assetId: string) {
    const instance = canvas.current, asset = assets[assetId]
    if (!instance || !ready || !asset) return
    setBusy(true); setError(null)
    try {
      const front = format.panels.find((panel) => panel.id === 'front') ?? format.panels[0]
      const width = front.width * 0.35
      const element: Element = { id: crypto.randomUUID(), type: 'image', name: asset.name, assetId,
        x: front.x + front.width * 0.08, y: format.height * 0.15, width, height: width * asset.height / asset.width,
        fit: 'contain', focalX: 0.5, focalY: 0.5, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, visible: true, locked: false }
      const object = await renderElement(element, assets, new AbortController().signal)
      if (canvas.current !== instance) return
      records.current.set(object, element)
      instance.add(object); instance.setActiveObject(object); instance.requestRenderAll()
      setShowLogos(false)
      sync(instance)
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : 'Unable to add this logo.') }
    finally { if (mounted.current) setBusy(false) }
  }

  async function changeElementType(type: Element['type']) {
    const instance = canvas.current, active = instance?.getActiveObject()
    const original = active && records.current.get(active)
    if (!original || !active || type === original.type) return
    const current = readElement(active, original)
    if (current.typeMemory?.[type]) { await editElement(switchElementType(current, current.typeMemory[type]!)); return }
    if (type === 'image') { imageTarget.current = current; setShowAssets(true); return }
    const base = { ...current, styleRef: undefined }
    let next: Element
    switch (type) {
      case 'text': next = { ...base, type, text: 'New text', fontFamily: 'Arial', fontSize: 24, fill: '#172129' }; break
      case 'shape': next = { ...base, type, fill: '#c2e3b5' }; break
      case 'table': next = { ...base, type, cells: [['Heading', 'Value'], ['Item', 'Description']], fill: '#ffffff', textColor: '#172129', fontSize: 18 }; break
      case 'qr': next = { ...base, type, url: 'https://store.steampowered.com/' }; break
      case 'rating': next = { ...base, type, rating: '12' }; break
    }
    await editElement(switchElementType(current, next))
  }

  async function editElement(next: Element, preservePlacement = true) {
    const instance = canvas.current, active = instance?.getActiveObject()
    if (!instance || !active) return
    const request = ++editRequest.current
    const current = readElement(active, records.current.get(active)!)
    if (preservePlacement) next = { ...next, x: current.x, y: current.y, width: current.width, height: current.height, scaleX: current.scaleX, scaleY: current.scaleY, rotation: current.rotation }
    const index = instance.getObjects().indexOf(active)
    const object = await renderElement(next, assets, new AbortController().signal, true)
    if (canvas.current !== instance || instance.getActiveObject() !== active || request !== editRequest.current) { object.dispose(); return }
    instance.remove(active)
    records.current.delete(active)
    records.current.set(object, next)
    instance.insertAt(index, object)
    instance.setActiveObject(object)
    instance.requestRenderAll()
    sync(instance)
  }

  async function restoreElement() {
    const instance = canvas.current, active = instance?.getActiveObject()
    const design = project.composition.design
    if (!instance || !active || !selection || !design || !design.overrides[selection.id]) return
    const restoredDesign = structuredClone(design)
    delete restoredDesign.overrides[selection.id]
    const element = composeDesign({ ...project, composition: { ...project.composition, design: restoredDesign } }).composition.elements.find((item) => item.id === selection.id)
    if (!element) return
    setBusy(true)
    setError(null)
    try {
      const object = await renderElement(element, assets, new AbortController().signal)
      if (canvas.current !== instance || instance.getActiveObject() !== active) return
      const index = instance.getObjects().indexOf(active)
      instance.remove(active)
      records.current.delete(active)
      records.current.set(object, element)
      instance.insertAt(index, object)
      instance.setActiveObject(object)
      instance.requestRenderAll()
      setExported(null)
      onResetElement(element.id)
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Unable to restore this element.')
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  async function importImage(asset: Asset) {
    const instance = canvas.current
    if (!instance || !ready) return
    setBusy(true)
    setError(null)
    const target = imageTarget.current
    imageTarget.current = null
    const url = URL.createObjectURL(asset.blob)
    try {
      let object = await FabricImage.fromURL(url)
      if (canvas.current !== instance) return
      const front = format.panels.find((panel) => panel.id === 'front')!
      const scale = Math.min(front.width * 0.8 / object.width, format.height * 0.6 / object.height, 1)
      let element: Element = {
        id: crypto.randomUUID(), name: asset.name, type: 'image', assetId: asset.id,
        x: front.x + front.width * 0.08, y: format.height * 0.12, width: object.width, height: object.height,
        scaleX: scale, scaleY: scale, rotation: 0, opacity: 1, visible: true, locked: false,
      }
      object.set({ originX: 'left', originY: 'top', left: element.x, top: element.y, scaleX: scale, scaleY: scale })
      if (target) {
        const previous = instance.getObjects().find((item) => records.current.get(item)?.id === target.id)
        if (!previous) return
        const current = readElement(previous, records.current.get(previous)!)
        element = switchElementType(current, { ...current, type: 'image', assetId: asset.id, fit: 'contain', focalX: 0.5, focalY: 0.5, styleRef: undefined })
        element = { ...element, type: 'image', assetId: asset.id }
        object = await renderElement(element, { ...assets, [asset.id]: asset }, new AbortController().signal) as FabricImage
        if (canvas.current !== instance) return
        const index = instance.getObjects().indexOf(previous)
        instance.remove(previous)
        records.current.delete(previous)
        records.current.set(object, element)
        instance.insertAt(index, object)
      } else {
        records.current.set(object, element)
        instance.add(object)
      }
      instance.setActiveObject(object)
      instance.requestRenderAll()
      sync(instance)
    } catch {
      if (mounted.current) setError('This image could not be opened. Try a PNG, JPEG, WebP, or SVG file.')
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
    sync(instance, undefined, `text:${records.current.get(object)?.id}`)
  }

  function changeTextStyle(property: 'fill' | 'fontFamily' | 'fontSize', value: string | number) {
    const instance = canvas.current, object = instance?.getActiveObject()
    if (!instance || !(object instanceof Textbox)) return
    object.set({ [property]: value }); object.setCoords(); instance.requestRenderAll(); sync(instance)
    setSelection(readElement(object, records.current.get(object)!))
  }

  function removeSelected() {
    const instance = canvas.current
    if (!instance) return
    for (const object of instance.getActiveObjects()) {
      if (records.current.get(object)?.blockId) continue
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

  function changeImageFilter(update: Partial<ImageFilters> | null) {
    const instance = canvas.current, active = instance?.getActiveObject()
    const original = active ? records.current.get(active) : undefined
    if (!instance || !active || original?.type !== 'image') return
    const current = readElement(active, original)
    if (current.type !== 'image') return
    const next = { ...current, filters: update ? { ...current.filters, ...update } : {} }
    // Commit before asynchronous rendering: switching selection or closing the
    // editor must not discard an adjustment that the user has already made.
    records.current.set(active, next)
    setSelection(next)
    sync(instance, undefined, `image-filters:${next.id}`)
    void editElement(next).catch(() => setError('Unable to apply image filters.'))
  }

  const elementControls = <section className="element-controls" aria-label="Selected element settings">
    <p className="eyebrow">SELECTED ELEMENT</p>
    <h3>{selection?.name ?? 'Make it yours.'}</h3>
    {selection && <label className="field">Element type<select aria-label="Selected element type" value={selection.type} disabled={busy} onChange={(event) => void changeElementType(event.target.value as Element['type'])}>
      <option value="image">Image</option><option value="text">Text</option><option value="shape">Box</option><option value="table">Table</option><option value="rating">PEGI</option><option value="qr">QR code</option>
    </select></label>}
    {selection?.type === 'image' && <button disabled={busy} onClick={() => { const active = canvas.current?.getActiveObject(); if (active) imageTarget.current = readElement(active, selection); setShowAssets(true) }}>Replace image</button>}
    {selection?.type === 'image' && <div className="selection-styles">
      <label className="field">Image fit<select aria-label="Image fit" value={selection.fit ?? 'stretch'} onChange={(e) => void editElement({ ...selection, fit: e.target.value === 'stretch' ? undefined : e.target.value as 'cover' | 'contain' | 'repeat' })}>
        <option value="stretch">Stretch</option><option value="cover">Cover</option><option value="contain">Contain</option><option value="repeat">Repeat</option>
      </select></label>
      <div className="form-row">{(['x', 'y'] as const).map((axis) => <label className="field" key={axis}>Position {axis.toUpperCase()} (px)<input aria-label={`Image position ${axis.toUpperCase()}`} type="number" step="1" value={Math.round(selection[axis] * 100) / 100} onChange={(e) => { const value = e.target.valueAsNumber; if (Number.isFinite(value)) void editElement({ ...selection, [axis]: value }, false) }} /></label>)}</div>
      <label className="field">Scale (%)<input aria-label="Image scale" type="number" min="1" step="5" value={Math.round((selection.imageScale ?? 1) * 100)} onChange={(e) => { const value = e.target.valueAsNumber; if (value > 0) void editElement({ ...selection, fit: selection.fit ?? 'contain', imageScale: value / 100 }) }} /></label>
      <div className="form-row">{(['offsetX', 'offsetY'] as const).map((axis) => <label className="field" key={axis}>Offset {axis === 'offsetX' ? 'X' : 'Y'} (px)<input aria-label={`Image ${axis}`} type="number" step="1" value={selection[axis] ?? 0} onChange={(e) => { const value = e.target.valueAsNumber; if (Number.isFinite(value)) void editElement({ ...selection, fit: selection.fit ?? 'contain', [axis]: value }) }} /></label>)}</div>
      <button onClick={() => void editElement({ ...selection, imageScale: 1, offsetX: 0, offsetY: 0, focalX: 0.5, focalY: 0.5 })}>Center image & reset scale</button>
      <p className="small muted">Drag the frame on the canvas to move it. Scale and offsets adjust the image inside its frame.</p>
    </div>}
    {selection?.type === 'image' && <section aria-label="Image filters" className="selection-styles">
      <h3>Image filters</h3>
      {(['brightness', 'contrast', 'saturation'] as const).map((key) => <label className="field" key={key}>{key[0].toUpperCase() + key.slice(1)} · {Math.round((selection.filters?.[key] ?? 0) * 100)}%<input aria-label={`Image ${key}`} type="range" min="-1" max="1" step="0.01" value={selection.filters?.[key] ?? 0} onChange={(event) => changeImageFilter({ [key]: Number(event.target.value) })} /></label>)}
      {(['grayscale', 'invert'] as const).map((key) => <label className="checkbox-field" key={key}><input type="checkbox" checked={selection.filters?.[key] ?? false} onChange={(event) => changeImageFilter({ [key]: event.target.checked })} />{key === 'grayscale' ? 'Grayscale' : 'Invert colors'}</label>)}
      <label className="checkbox-field"><input type="checkbox" checked={Boolean(selection.filters?.tint)} onChange={(event) => changeImageFilter({ tint: event.target.checked ? '#26322d' : undefined })} />Use a single color</label>
      {selection.filters?.tint && <label className="field">Image color<input aria-label="Image color" type="color" value={selection.filters.tint} onChange={(event) => changeImageFilter({ tint: event.target.value })} /></label>}
      <label className="field">Image blur · {Math.round((selection.filters?.blur ?? 0) * 100)}%<input aria-label="Image blur" type="range" min="0" max="1" step="0.01" value={selection.filters?.blur ?? 0} onChange={(event) => changeImageFilter({ blur: Number(event.target.value) })} /></label>
      <label className="field">Backdrop blur · {selection.filters?.backdropBlur ?? 0} px<input aria-label="Backdrop blur" type="range" min="0" max="100" step="1" value={selection.filters?.backdropBlur ?? 0} onChange={(event) => changeImageFilter({ backdropBlur: Number(event.target.value) })} /></label>
      <p className="small muted">Backdrop blur softens layers behind the image frame. It shows through transparent areas.</p>
      <label className="checkbox-field"><input type="checkbox" checked={Boolean(selection.filters?.shadow)} onChange={(event) => changeImageFilter({ shadow: event.target.checked ? { color: '#000000', opacity: 0.6, blur: 12, offsetX: 0, offsetY: 0 } : undefined })} />Contour shadow</label>
      {selection.filters?.shadow && <>
        <label className="field">Shadow color<input aria-label="Shadow color" type="color" value={selection.filters.shadow.color} onChange={(event) => changeImageFilter({ shadow: { ...selection.filters!.shadow!, color: event.target.value } })} /></label>
        <label className="field">Shadow opacity<input aria-label="Shadow opacity" type="range" min="0" max="1" step="0.01" value={selection.filters.shadow.opacity} onChange={(event) => changeImageFilter({ shadow: { ...selection.filters!.shadow!, opacity: Number(event.target.value) } })} /></label>
        <label className="field">Shadow blur · {selection.filters.shadow.blur} px<input aria-label="Shadow blur" type="range" min="0" max="100" step="1" value={selection.filters.shadow.blur} onChange={(event) => changeImageFilter({ shadow: { ...selection.filters!.shadow!, blur: Number(event.target.value) } })} /></label>
        <div className="form-row">{(['offsetX', 'offsetY'] as const).map((key) => <label className="field" key={key}>Shadow {key === 'offsetX' ? 'X' : 'Y'}<input aria-label={`Shadow ${key}`} type="number" min="-200" max="200" value={selection.filters!.shadow![key]} onChange={(event) => { const value = event.target.valueAsNumber; if (Number.isFinite(value) && Math.abs(value) <= 200) changeImageFilter({ shadow: { ...selection.filters!.shadow!, [key]: value } }) }} /></label>)}</div>
      </>}
      <button onClick={() => changeImageFilter(null)}>Reset filters</button>
      <p className="small muted">Applies to this element. The original asset stays unchanged.</p>
    </section>}
    {selection?.blockId && project.composition.design && <><button disabled={busy || !project.composition.design.overrides[selection.id]} title="Reset this element’s content, type, style and position to the current template" onClick={() => void restoreElement()}>Restore template element</button><p className="small muted">Resets this element’s content, type, style and position to the current template.</p></>}
    {selectedText !== null ? <label className="field">Selected text
      <textarea aria-label="Selected text" rows={7} value={selectedText} onChange={(event) => editText(event.target.value)} />
    </label> : <p className="muted">{'Edit the selected element’s properties.'}</p>}
    {selection?.type === 'text' && selectedText !== null && <div className="selection-styles">
      <label className="field">Individual text color<input type="color" aria-label="Individual text color" value={selection.fill.startsWith('#') ? selection.fill : '#172129'} onChange={(e) => changeTextStyle('fill', e.target.value)} /></label>
      <label className="field">Individual font<select aria-label="Individual font" value={selection.fontFamily} onChange={(e) => changeTextStyle('fontFamily', e.target.value)}>{['Georgia', 'Arial', 'Verdana', 'Times New Roman', 'Courier New'].map((font) => <option key={font}>{font}</option>)}</select></label>
      {project.composition.design && selection.blockId && <p className="small muted">Shared style: {selection.styleRef}. Edits here override this element.</p>}
    </div>}
    {selection?.type === 'shape' && <label className="field">Box color<input type="color" value={selection.fill} onChange={(event) => void editElement({ ...selection, fill: event.target.value })} /></label>}
    {selection?.type === 'qr' && <label className="field">URL<input aria-label="QR URL" type="url" maxLength={2000} value={selection.url} placeholder="https://example.com" onChange={(event) => void editElement({ ...selection, url: event.target.value })} /><span className="small muted">The QR updates automatically. Enter a complete URL, including https://.</span>{!qrMatrix(selection.url) && <span role="status" className="error">Enter a valid HTTP or HTTPS URL (maximum 2,000 characters).</span>}</label>}
    {selection?.type === 'rating' && <label className="field">PEGI rating<select value={selection.rating} onChange={(event) => void editElement({ ...selection, rating: event.target.value as typeof selection.rating })}>{['3', '7', '12', '16', '18'].map((rating) => <option key={rating}>{rating}</option>)}</select><span className="small muted">Editable rating placeholder. Use an image for an official badge.</span></label>}
    {selection?.type === 'table' && <div className="selection-styles">
      <label className="field">Padding (px)<input aria-label="Table padding" type="number" min="0" max="1000" step="1" value={selection.padding ?? 8} onChange={(event) => { const padding = event.target.valueAsNumber; if (Number.isFinite(padding) && padding >= 0 && padding <= 1000) void editElement({ ...selection, padding }) }} /></label>
      <label className="checkbox-field"><input type="checkbox" checked={selection.contentFormat === 'markdown'} onChange={(event) => void editElement({ ...selection, contentFormat: event.target.checked ? 'markdown' : undefined })} />Markdown content</label>
      <p className="small muted">{selection.contentFormat === 'markdown' ? 'Use ### for headings, - for bullets, and **bold** for labels.' : 'Edit each cell. Add rows and columns to expand the table.'}</p>
      <div className="table-column-actions">{selection.cells[0].map((_, c) => <button key={c} disabled={busy || selection.cells[0].length <= 1} aria-label={`Delete column ${c + 1}`} onClick={() => void editElement({ ...selection, cells: selection.cells.map((row) => row.filter((_, index) => index !== c)), icons: selection.icons?.map((row) => row.filter((_, index) => index !== c)) })}>Delete column {c + 1}</button>)}</div>
      {selection.cells.map((row, r) => <div className="table-row-editor" key={r}>
        <div className="table-row-heading"><strong>Row {r + 1}</strong><button disabled={busy || selection.cells.length <= 1} aria-label={`Delete row ${r + 1}`} onClick={() => void editElement({ ...selection, cells: selection.cells.filter((_, index) => index !== r), icons: selection.icons?.filter((_, index) => index !== r) })}>Delete row</button></div>
        <div className="table-cell-row">{row.map((cell, c) => <div className="table-cell-editor" key={c}>
          <div className="table-cell-heading"><label htmlFor={`cell-${selection.id}-${r}-${c}`}>Column {c + 1}</label><button className="cell-icon-trigger" disabled={busy} aria-label={`Choose icon for row ${r + 1}, column ${c + 1}`} title={tableIcons.find((icon) => icon.id === selection.icons?.[r]?.[c])?.label ?? 'Choose icon'} onClick={() => setIconCell({ id: selection.id, row: r, column: c })}>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={tableIcons.find((icon) => icon.id === selection.icons?.[r]?.[c])?.path ?? 'M4 4h16v16H4zM12 8v8M8 12h8'} /></svg><span>Icon</span>
          </button></div>
          <textarea id={`cell-${selection.id}-${r}-${c}`} aria-label={`Row ${r + 1}, column ${c + 1}`} rows={selection.contentFormat === 'markdown' ? 9 : 2} value={cell} onChange={(event) => void editElement({ ...selection, cells: selection.cells.map((values, ri) => values.map((value, ci) => ri === r && ci === c ? event.target.value : value)) })} />
        </div>)}</div>
      </div>)}
      <div className="toolbar-group">
        <button disabled={selection.cells.length >= 20} onClick={() => void editElement({ ...selection, cells: [...selection.cells, selection.cells[0].map(() => '')], icons: selection.icons ? [...selection.icons, selection.cells[0].map(() => null)] : undefined })}>+ Row</button>
        <button disabled={selection.cells[0].length >= 10} onClick={() => void editElement({ ...selection, cells: selection.cells.map((row) => [...row, '']), icons: selection.icons?.map((row) => [...row, null]) })}>+ Column</button>
      </div>
    </div>}
    {!project.composition.design && <>
    <div className="details">
      <span>Working format</span><strong>{format.name ?? 'PC / Steam'}</strong>
      <span>Canvas</span><strong>{format.width} × {format.height} px</strong>
      <span>Panels</span><strong>Back · Spine · Front</strong>
    </div>
    <p className="small muted">Digital working dimensions. Physical case measurements will be validated before print export.</p>
    </>}

  </section>

  return (
    <div className="editor">
      {iconCell && selection?.type === 'table' && selection.id === iconCell.id && selection.cells[iconCell.row]?.[iconCell.column] !== undefined && <TableIconPicker value={selection.icons?.[iconCell.row]?.[iconCell.column] ?? null} onClose={() => setIconCell(null)} onSelect={(icon) => {
        void editElement({ ...selection, icons: selection.cells.map((row, r) => row.map((_, c) => r === iconCell.row && c === iconCell.column ? icon : selection.icons?.[r]?.[c] ?? null)) })
        setIconCell(null)
      }} />}
      <div className="editor-toolbar">
        <div className="toolbar-group">
          {([['image', '▧', 'Image'], ['text', 'T', 'Text'], ['shape', '□', 'Box'], ['table', '▦', 'Table'], ['rating', '12', 'PEGI'], ['qr', '▦', 'QR code']] as const).map(([type, icon, label]) => <button key={type} className="element-icon-button" title={`Add ${label}`} aria-label={`Add ${label}`} disabled={!ready || busy} onClick={() => void addElement(type)}><span aria-hidden="true">{icon}</span><span className="small">{label}</span></button>)}
          <button className="element-icon-button" disabled={!ready || busy} aria-expanded={showLogos} aria-controls="shared-logo-library" onClick={() => setShowLogos((shown) => !shown)}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="m12 3 3 6 6 1-4.5 4.5 1 6.5-5.5-3-5.5 3 1-6.5L3 10l6-1z" /></svg><span className="small">Logos</span></button>
          <button className="element-icon-button" disabled={!hasSelection || busy} onClick={removeSelected}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></svg><span className="small">Delete</span></button>
          <button className="element-icon-button" disabled={!ready || busy || !canUndo} onClick={onUndo} title="Undo (Ctrl/Cmd+Z)"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m9 4-6 6 6 6M3 10h11a7 7 0 0 1 7 7v3" /></svg><span className="small">Undo</span></button>
          <button className="element-icon-button" disabled={!ready || busy || !canRedo} onClick={onRedo} title="Redo (Ctrl/Cmd+Shift+Z)"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m15 4 6 6-6 6M21 10H10a7 7 0 0 0-7 7v3" /></svg><span className="small">Redo</span></button>
        </div>
        <div className="toolbar-group">
          <label className="zoom-control">Zoom
            <select aria-label="Zoom" value={zoom} onChange={(event) => setCanvasZoom(Number(event.target.value))}>
              {![0.2, 0.3, 0.4, 0.6, 0.8, 1].includes(zoom) && <option value={zoom}>{Math.round(zoom * 100)}%</option>}
              <option value={0.2}>20%</option><option value={0.3}>30%</option>
              <option value={0.4}>40%</option><option value={0.6}>60%</option>
              <option value={0.8}>80%</option><option value={1}>100%</option>
            </select>
          </label>
          <button className="primary" disabled={!ready || busy} onClick={() => void exportPng()}>{busy ? 'Working…' : 'Export PNG ↗'}</button>
        </div>
      </div>
      {showLogos && <section id="shared-logo-library" className="logo-library" aria-label="Shared logo library">
        <div className="section-heading"><h2>Shared logos</h2><button onClick={() => setShowLogos(false)}>Close logos</button></div>
        <p className="small muted">Choose a logo to add it to your cover. Resize and move it on the canvas.</p>
        <div className="logo-library-grid">{sharedLogos.map((logo) => <button key={logo.id} disabled={busy} onClick={() => void addLogo(logo.id)} aria-label={`Add ${logo.label}`}>
          <span className="logo-preview" data-tone={logo.tone}><img src={logo.preview} alt="" /></span><span>{logo.label}</span>
        </button>)}</div>
      </section>}
      {showAssets && <AssetPicker project={project} assets={assets} onUpload={onUploadAssets} onClose={() => { imageTarget.current = null; setShowAssets(false) }} onSelect={(asset) => { setShowAssets(false); void importImage(asset) }} />}
      {error && <p className="error" role="alert">{error}</p>}
      {warnings.length > 0 && <details className="layout-warning"><summary>{warnings.length} text {warnings.length === 1 ? 'area needs' : 'areas need'} more space</summary><p>{warnings.join(' · ')}</p></details>}
      {exported && <p className="export-result" role="status">PNG ready · {format.width} × {format.height} px. <a href={exported.url} download={exported.filename}>Save PNG</a></p>}
      <div className="editor-body">
        <div className="canvas-workspace" ref={workspace} onPointerDown={(event) => {
          if (event.button !== 0 || (event.target as HTMLElement).closest('.canvas-frame')) return
          const instance = canvas.current
          if (!instance) return
          instance.discardActiveObject()
          instance.requestRenderAll()
          blockSelectionHandler.current('')
        }}>
          <div className="canvas-sheet" style={{ width: format.width * zoom }}>
            <div className="panel-labels">
              {format.panels.map((panel) => <span key={panel.id} style={{ width: `${panel.width / format.width * 100}%` }}>{panel.id}</span>)}
            </div>
            <div className="canvas-frame">
              <canvas ref={canvasElement} aria-label="Cover composition editor" />
              {format.panels.slice(1).map((panel) => <span className="panel-guide" key={panel.id} style={{ left: `${panel.x / format.width * 100}%` }} />)}
            </div>
          </div>
          <p className="canvas-note">{project.composition.design ? 'Drag to position · Use handles to resize and rotate · Select a template element to edit its content in the sidebar' : 'Drag to position · Use handles to resize and rotate · Double-click text to edit'}</p>
        </div>
        {project.composition.design
          ? inspectorHost && selection && (selection.id === selectedBlockId || selection.blockId === selectedBlockId) && createPortal(elementControls, inspectorHost)
          : <aside className="inspector">{elementControls}</aside>}

      </div>
    </div>
  )
}

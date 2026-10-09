import { useState } from 'react'
import { colorLabels } from '../domain/colorLabels'
import { AssetPicker } from './AssetPicker'
import type { Asset, ColorRole, CoverDesign, DesignBlock, FontRole, Format, Project, TextRole } from '../domain/types'
import { caseFormats } from '../domain/caseFormats'
import { useAutosaveInteraction } from './useAutosaveInteraction'
import { sharedLogos } from '../assets/logoLibrary'

type Props = {
  onUploadAssets: (assets: Asset[]) => void
  onElementControlsHost: (node: HTMLDivElement | null) => void
  selectionRequest: number
  selectedBlockId: string
  onSelectBlock: (id: string) => void
  project: Project
  assets: Record<string, Asset>
  onChange: (update: (design: CoverDesign) => void, assets?: Asset[], group?: string) => void
  onFormat: (format: Format) => void
  onInteractionStart: () => void
  onInteractionEnd: () => void
}


const fontChoices = ['Georgia', 'Arial', 'Verdana', 'Times New Roman', 'Courier New']

export function TemplateInspector({ onUploadAssets, onElementControlsHost, selectionRequest, selectedBlockId, onSelectBlock, project, assets, onChange, onFormat, onInteractionStart, onInteractionEnd }: Props) {
  const sliderInteraction = useAutosaveInteraction(onInteractionStart, onInteractionEnd)
  const design = project.composition.design!
  const [tabState, setTabState] = useState<{ value: 'blocks' | 'styles' | 'format'; request: number }>({ value: 'blocks', request: selectionRequest })
  const tab = tabState.request === selectionRequest ? tabState.value : 'blocks'
  const setTab = (value: 'blocks' | 'styles' | 'format') => setTabState({ value, request: selectionRequest })
  const [role, setRole] = useState<TextRole>('caption')
  const [picker, setPicker] = useState<{ key: string; label: string } | null>(null)
  const selectedElement = project.composition.elements.find((element) => element.id === selectedBlockId)
  const selectedTemplateBlock = design.blocks.find((b) => b.id === selectedBlockId)
  const block = selectedTemplateBlock ?? design.blocks[0]
  const isEditing = Boolean(selectedElement || selectedTemplateBlock || selectedBlockId === '__multiple__')
  const visibilityToggle = (element: CoverDesign['extras'][number]['element']) => <label className="checkbox-field element-visibility"><input type="checkbox" role="switch" aria-label={`Show ${element.name}`} checked={element.visible} onChange={(event) => onChange((next) => {
    const extra = next.extras.find((entry) => entry.element.id === element.id)
    if (extra) extra.element.visible = event.target.checked
    else next.overrides[element.id] = { ...next.overrides[element.id], hidden: !event.target.checked }
  })} />Visible</label>
  const updateBlock = (update: (block: DesignBlock) => void, group?: string) => onChange((next) => { const target = next.blocks.find((b) => b.id === block.id); if (target) update(target) }, [], group)
  const shared = (key: keyof CoverDesign['shared'], label: string, rows = 2) => <label className="field" key={key}>{label}
    <textarea aria-label={label} rows={rows} value={design.shared[key]} onChange={(e) => onChange((next) => { next.shared[key] = e.target.value; if (key === 'rating') delete next.images.ratingLogo }, [], `shared:${key}`)} />
  </label>

  function slot(key: string, label: string) {
    const image = design.images[key]
    return <div className="asset-slot" key={key}>
      {key === 'platformLogo' && <label className="field">Shared logo<select aria-label="Steam logo source" value={sharedLogos.some((logo) => logo.id === image?.assetId) ? image.assetId : image ? 'custom' : ''} onChange={(event) => onChange((next) => {
        const id = event.target.value
        if (id) next.images[key] = { assetId: id, fit: 'contain', focalX: 0.5, focalY: 0.5 }
        else delete next.images[key]
      })}>
        <option value="">Steam logo · automatic contrast</option>
        {image && !sharedLogos.some((logo) => logo.id === image.assetId) && <option value="custom" disabled>Uploaded logo</option>}
        {sharedLogos.map((logo) => <option key={logo.id} value={logo.id}>{logo.label}</option>)}
      </select><span className="small muted">Available in every cover. Automatic contrast uses white on dark backgrounds and black on light backgrounds.</span></label>}
      <div className="field"><span>{label}</span><button onClick={() => setPicker({ key, label })}>{image ? 'Change image' : 'Select image'}</button></div>
      {image && <><p className="asset-name">{assets[image.assetId]?.name ?? 'Imported image'}</p>
        {image.fit === 'cover' && <div className="form-row">{(['focalX', 'focalY'] as const).map((axis) => <label className="field" key={axis}>{axis === 'focalX' ? 'Focus X' : 'Focus Y'}<input {...sliderInteraction} aria-label={`${label} ${axis}`} type="range" min="0" max="1" step="0.01" value={image[axis]} onChange={(e) => onChange((next) => { next.images[key][axis] = Number(e.target.value) }, [], `focus:${key}:${axis}`)} /></label>)}</div>}
        <button onClick={() => onChange((next) => { delete next.images[key] })}>{key === 'platformLogo' ? 'Restore automatic Steam logo' : 'Remove image'}</button></>}
    </div>
  }

  function items() {
    const isRequirements = block.kind === 'requirements', isGallery = block.kind === 'gallery', isFeatures = block.kind === 'features'
    return <div className="block-items">{block.items.map((item, index) => <div className="block-item" key={item.id}>
      <span className="eyebrow">{isGallery ? 'SCREENSHOT' : 'ITEM'} {index + 1}</span>
      <label className="field">{isGallery ? 'Caption' : 'Label'}<textarea aria-label={`${block.name} item ${index + 1} label`} rows={2} value={item.title} onChange={(e) => updateBlock((b) => { b.items[index].title = e.target.value }, `item:${item.id}:title`)} /></label>
      {isRequirements && <div className="form-row">{(['text', 'detail'] as const).map((key) => <label className="field" key={key}>{key === 'text' ? 'Minimum' : 'Recommended'}<textarea aria-label={`${item.title} ${key === 'text' ? 'minimum' : 'recommended'}`} rows={2} value={item[key]} onChange={(e) => updateBlock((b) => { b.items[index][key] = e.target.value }, `item:${item.id}:${key}`)} /></label>)}</div>}
      {isFeatures && <label className="field">Fallback icon<input aria-label={`${item.title} icon`} value={item.text} onChange={(e) => updateBlock((b) => { b.items[index].text = e.target.value }, `item:${item.id}:icon`)} /></label>}
      {!isRequirements && slot(item.id, isGallery ? `Screenshot ${index + 1}` : `Icon ${index + 1}`)}
      <button onClick={() => onChange((next) => { next.blocks.find((b) => b.id === block.id)!.items.splice(index, 1); delete next.images[item.id] })}>Remove item</button>
    </div>)}
      <button disabled={block.items.length >= (isGallery ? 6 : 8)} onClick={() => updateBlock((b) => { b.items.push({ id: `${isGallery ? 'shot' : 'item'}-${crypto.randomUUID()}`, title: 'New item', text: '', detail: '' }) })}>+ Add {isGallery ? 'screenshot' : 'item'}</button>
    </div>
  }

  return <aside className="template-inspector" aria-label="Template settings">
    <p className="eyebrow">STEAM · EDITORIAL</p><h2>Your cover, in detail.</h2>
    <div className="inspector-tabs" role="tablist" aria-label="Template settings tabs">{(['blocks', 'styles', 'format'] as const).map((value) => <button key={value} role="tab" aria-selected={tab === value} onClick={() => setTab(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}</div>
    <fieldset>
    {tab === 'blocks' && <section aria-label="Edit template blocks">
      {!isEditing ? <div className="block-list" aria-label="Cover blocks">
        <p className="small muted">Layers are listed from front to back. Select an element to change its layer order. Hidden elements stay here so you can show them again.</p>
        <ul className="block-element-list">{[...project.composition.elements].reverse().map((element) => <li key={element.id}><button className="block-list-entry" onClick={() => onSelectBlock(element.id)}><span>{element.name}<small>{element.type.toUpperCase()}{!element.visible ? ' · Hidden' : ''}</small></span><span aria-hidden="true">→</span></button>{visibilityToggle(element)}</li>)}</ul>
      </div> : <>
      <button className="back-button" onClick={() => onSelectBlock('')}>← All blocks</button>
      {selectedElement && visibilityToggle(selectedElement)}
      {selectedTemplateBlock && <h3>{selectedTemplateBlock.name}</h3>}
      <div ref={onElementControlsHost} className="element-controls-host" />
      {selectedTemplateBlock && <>
      <label className="checkbox-field"><input type="checkbox" checked={!block.hidden} onChange={(e) => updateBlock((b) => { b.hidden = !e.target.checked })} />Visible block</label>
      {block.kind === 'artwork' && slot(block.panel === 'front' ? 'frontArt' : 'backArt', block.panel === 'front' ? 'Front artwork' : 'Back artwork')}
      {block.kind === 'platform' && slot('platformLogo', 'Steam logo')}
      {block.kind === 'title' && <>{shared('title', 'Game title')}{slot('gameLogo', 'Game logo')}</>}
      {block.kind === 'intro' && <>{shared('headline', 'Back headline', 3)}{shared('synopsis', 'Synopsis', 6)}</>}
      {block.kind === 'review' && <>{shared('quote', 'Review quote')}{shared('attribution', 'Review attribution', 1)}</>}
      {block.kind === 'publisher' && <>{shared('publisher', 'Publisher name')}{slot('publisherLogo', 'Publisher logo')}{block.panel === 'back' && shared('legal', 'Legal text', 4)}</>}
      {block.kind === 'rating' && <>{<label className="field">PEGI rating<select aria-label="PEGI rating" value={design.shared.rating} onChange={(e) => onChange((next) => { next.shared.rating = e.target.value; delete next.images.ratingLogo }, [], 'shared:rating')}>{['3', '7', '12', '16', '18'].map((rating) => <option key={rating} value={rating}>{rating}</option>)}</select></label>}{slot('ratingLogo', 'PEGI badge')}{block.panel === 'back' && items()}<p className="small muted">The rating is shared with the front cover. Changing it resets an uploaded badge so you can supply the matching artwork.</p></>}
      {['gallery', 'requirements', 'features'].includes(block.kind) && items()}
      {block.kind === 'spine' && <>{shared('title', 'Game title')}{shared('publisher', 'Publisher name')}{slot('platformLogo', 'Steam logo')}<p className="small muted">Game, Steam and publisher logos are shared with the other panels. Change the spine colors in Styles.</p></>}
      <details className="layout-settings"><summary>Block position & size</summary><div className="form-row">{(['x', 'y', 'width', 'height'] as const).map((key) => <label className="field" key={key}>{key} (%)<input aria-label={`Block ${key} percent`} type="number" min={key === 'width' || key === 'height' ? 1 : 0} max="100" step="1" value={Math.round(block[key] * 100)} onChange={(e) => {
        const amount = Number(e.target.value); if (!Number.isFinite(amount)) return
        updateBlock((b) => { b[key] = Math.max(key === 'width' || key === 'height' ? 0.01 : 0, Math.min(1, amount / 100)) }, `layout:${block.id}:${key}`)
      }} /></label>)}</div></details>
      <button onClick={() => onChange((next) => { for (const key of Object.keys(next.overrides)) if (key.startsWith(`${next.instanceId}:${block.id}:`)) delete next.overrides[key] })}>Reset individual changes in this block</button>
      </>}
      </>}
    </section>}
    {tab === 'styles' && <section aria-label="Shared styles">
      <p className="small muted">Changes apply to all template elements referencing the style.</p>
      <div className="color-grid">{(Object.keys(colorLabels) as ColorRole[]).map((key) => <label className="field color-field" key={key}>
        <span className="style-color-swatch" style={{ backgroundColor: design.styles.colors[key] }}><input type="color" aria-label={colorLabels[key]} value={design.styles.colors[key]} onChange={(event) => onChange((next) => { next.styles.colors[key] = event.target.value }, [], `color:${key}`)} /></span>
        <span>{colorLabels[key]}</span>
      </label>)}</div>
      {(Object.keys(design.styles.fonts) as FontRole[]).map((key) => <label className="field" key={key}>{key} font<select aria-label={`${key} font`} value={design.styles.fonts[key]} onChange={(e) => onChange((next) => { next.styles.fonts[key] = e.target.value })}>{fontChoices.map((font) => <option key={font}>{font}</option>)}</select></label>)}
      <h3>Text styles</h3><label className="field">Shared text style<select aria-label="Shared text style" value={role} onChange={(e) => setRole(e.target.value as TextRole)}>{(Object.keys(design.styles.text) as TextRole[]).map((key) => <option key={key}>{key}</option>)}</select></label>
      <div className="form-row"><label className="field">Font role<select aria-label="Text style font role" value={design.styles.text[role].font} onChange={(e) => onChange((next) => { next.styles.text[role].font = e.target.value as FontRole })}>{(Object.keys(design.styles.fonts) as FontRole[]).map((key) => <option key={key}>{key}</option>)}</select></label>
      <label className="field">Size<input aria-label="Shared text size" type="number" min="1" max="200" value={design.styles.text[role].size} onChange={(e) => { const size = Number(e.target.value); if (size > 0 && size <= 200) onChange((next) => { next.styles.text[role].size = size }, [], `size:${role}`) }} /></label></div>
      <label className="field">Color role<select aria-label="Text style color role" value={design.styles.text[role].color} onChange={(e) => onChange((next) => { next.styles.text[role].color = e.target.value as ColorRole })}>{(Object.keys(colorLabels) as ColorRole[]).map((key) => <option key={key} value={key}>{colorLabels[key]}</option>)}</select></label>
    </section>}
    {tab === 'format' && <section aria-label="Case format">
      <p className="small muted">Paper insert dimensions, including the spine. Print on A4 landscape at 100% scale.</p>
      <label className="field">Case format<select aria-label="Working format" value={caseFormats.some((f) => f.id === project.composition.format.id) ? project.composition.format.id : 'legacy'} onChange={(e) => { const format = caseFormats.find((f) => f.id === e.target.value); if (format) onFormat(format) }}><option value="legacy" disabled>Previous working format</option>{caseFormats.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
    </section>}
    </fieldset>
    {picker && <AssetPicker project={project} assets={assets} title={picker.label} onUpload={onUploadAssets} onClose={() => setPicker(null)} onSelect={(asset) => {
      onChange((next) => { next.images[picker.key] = { assetId: asset.id, fit: ['frontArt', 'backArt'].includes(picker.key) || picker.key.startsWith('shot-') ? 'cover' : 'contain', focalX: 0.5, focalY: 0.5 } })
      setPicker(null)
    }} />}
  </aside>
}

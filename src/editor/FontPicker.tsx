import { useEffect, useState } from 'react'
import { fontCatalog, loadFont } from './fonts'

export function FontPicker({ label, value, sample, onChange }: { label: string; value: string; sample: string; onChange: (family: string) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [preview, setPreview] = useState(value)
  const [loaded, setLoaded] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const visible = fontCatalog.filter(font => (category === 'All' || font.category === category) && font.family.toLowerCase().includes(query.toLowerCase()))
  const families = open ? visible.map(font => font.family).join('|') : value
  useEffect(() => {
    let cancelled = false
    for (const family of families.split('|').filter(Boolean)) {
      void loadFont(family).then(() => { if (!cancelled) setLoaded(current => current.includes(family) ? current : [...current, family]) }, () => { /* Show failures when a font is selected. */ })
    }
    return () => { cancelled = true }
  }, [families])
  async function choose(family: string) {
    setBusy(true)
    setError(null)
    try {
      await loadFont(family)
      onChange(family)
      setOpen(false)
    } catch (cause) { setError((cause as Error).message) }
    finally { setBusy(false) }
  }
  return <div className="font-picker">
    <span className="font-picker-label">{label}</span>
    <button type="button" className="font-picker-trigger" aria-label={label} aria-expanded={open} onClick={() => { setPreview(value); setOpen(!open) }} style={{ fontFamily: `"${value}"` }}>{value}<span aria-hidden="true">▾</span></button>
    {open && <div className="font-picker-panel" onKeyDown={event => { if (event.key === 'Escape') setOpen(false) }}>
      <input autoFocus type="search" aria-label={`Search ${label}`} placeholder="Search fonts…" value={query} onChange={event => setQuery(event.target.value)} />
      <select aria-label={`Category for ${label}`} value={category} onChange={event => setCategory(event.target.value)}>{['All', 'Serif', 'Sans serif', 'Display', 'Monospace'].map(item => <option key={item}>{item}</option>)}</select>
      <div className="font-picker-preview" style={{ fontFamily: `"${preview}"` }}>{sample || 'The quick brown fox · Aa 0123456789'}</div>
      <div className="font-picker-list" role="group" aria-label={`${label} choices`}>
        {visible.map(font => <button type="button" key={font.family} disabled={busy} aria-pressed={value === font.family} onFocus={() => setPreview(font.family)} onMouseEnter={() => setPreview(font.family)} onClick={() => void choose(font.family)}>
          <span className="font-picker-meta">{font.family}<small>{font.category}{!loaded.includes(font.family) && font.remote ? ' · Loading…' : ''}</small></span>
          <span className="font-picker-sample" style={{ fontFamily: `"${font.family}"` }}>Aa · The quick brown fox</span>
        </button>)}
        {!visible.length && <p className="small muted">No fonts found.</p>}
      </div>
      {busy && <p role="status">Loading font…</p>}
      {error && <p role="alert">{error}</p>}
      <button type="button" onClick={() => setOpen(false)}>Close</button>
    </div>}
  </div>
}

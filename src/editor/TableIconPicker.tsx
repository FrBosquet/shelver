import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { tableIcons } from '../domain/tableIcons'
import type { TableIconId } from '../domain/tableIcons'

type Props = { value: TableIconId | null; onSelect: (icon: TableIconId | null) => void; onClose: () => void }

export function TableIconPicker({ value, onSelect, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const node = dialog.current!
    node.showModal()
    return () => node.close()
  }, [])
  return createPortal(<dialog ref={dialog} className="table-icon-dialog" aria-labelledby="table-icon-title" onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose() } }}>
    <div className="section-heading"><h2 id="table-icon-title">Select cell icon</h2><button onClick={onClose} aria-label="Close icon selector">Close</button></div>
    <div className="cell-icon-options">
      <button aria-pressed={value === null} onClick={() => onSelect(null)}>None</button>
      {tableIcons.map((icon) => <button key={icon.id} aria-pressed={value === icon.id} onClick={() => onSelect(icon.id)}><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={icon.path} /></svg><span>{icon.label}</span></button>)}
    </div>
  </dialog>, document.body)
}

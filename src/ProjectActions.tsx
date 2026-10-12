import { useEffect, useRef } from 'react'

export function ProjectActions({ name, onExport, exportDisabled, onDuplicate, onDelete }: { name: string; onExport: () => void; exportDisabled: boolean; onDuplicate: () => void; onDelete: () => void }) {
  const ref = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    function dismiss(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) ref.current.open = false
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape' && ref.current?.open) {
        ref.current.open = false
        ref.current.querySelector('summary')?.focus()
      }
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', escape)
    }
  }, [])

  function run(action: () => void) {
    if (ref.current) {
      ref.current.open = false
      ref.current.querySelector('summary')?.focus()
    }
    action()
  }

  return <details className="project-actions" ref={ref} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) event.currentTarget.open = false
  }}>
    <summary aria-label={`Actions for ${name}`} title="Cover actions"><span aria-hidden="true">⋮</span></summary>
    <div className="project-actions-dropdown">
      <button disabled={exportDisabled} onClick={() => run(onExport)} aria-label={`Export project ${name}`}>Export project</button>
      <button onClick={() => run(onDuplicate)} aria-label={`Duplicate ${name}`}>Duplicate</button>
      <button className="delete-button" onClick={() => run(onDelete)} aria-label={`Delete ${name}`}>Delete</button>
    </div>
  </details>
}

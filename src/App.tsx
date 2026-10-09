import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { Asset, Element } from './domain/types'
import { useWorkspace } from './storage/useWorkspace'

const Editor = lazy(() => import('./editor/Editor').then((module) => ({ default: module.Editor })))

export function App() {
  const { projects, assets, loaded, status, error, history, store } = useWorkspace()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [zooms, setZooms] = useState<Record<string, number>>({})
  const [packageBusy, setPackageBusy] = useState<'import' | 'export' | null>(null)
  const [packageError, setPackageError] = useState<string | null>(null)
  const [packageDownload, setPackageDownload] = useState<{ url: string; filename: string } | null>(null)
  const importInput = useRef<HTMLInputElement>(null)
  const activeProject = projects.find((project) => project.id === activeId)
  const statusText = { loading: 'Loading library…', saving: 'Saving…', saved: 'Saved locally', error: loaded ? 'Changes not saved' : 'Library unavailable' }[status]

  useEffect(() => () => { if (packageDownload) URL.revokeObjectURL(packageDownload.url) }, [packageDownload])

  async function importProject(file: File) {
    setPackageBusy('import')
    setPackageError(null)
    try {
      const { importCoverProject } = await import('./packages/coverProject')
      const imported = await importCoverProject(file)
      setActiveId(store.importProject(imported.project, imported.assets))
    } catch (cause) {
      setPackageError(cause instanceof Error ? cause.message : 'Unable to import this project.')
    } finally { setPackageBusy(null) }
  }

  async function exportProject() {
    if (!activeProject) return
    const project = structuredClone(activeProject)
    const assetSnapshot = assets
    setPackageBusy('export')
    setPackageError(null)
    try {
      const { exportCoverProject } = await import('./packages/coverProject')
      const blob = await exportCoverProject(project, assetSnapshot)
      const url = URL.createObjectURL(blob)
      const filename = `${project.name.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'cover'}.coverproject`
      setPackageDownload({ url, filename })
    } catch (cause) {
      setPackageError(cause instanceof Error ? cause.message : 'Unable to export this project.')
    } finally { setPackageBusy(null) }
  }

  function newProject() {
    const id = store.create()
    if (id) setActiveId(id)
  }

  function changeElements(projectId: string, elements: Element[], asset?: Asset, group?: string) {
    store.changeElements(projectId, elements, asset, group)
  }

  function rename(name: string) {
    if (activeId) store.rename(activeId, name)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setActiveId(null) }}>
          <span className="brand-mark" aria-hidden="true">▥</span> shelver<span className="brand-dot">.</span>
        </a>
        <p className="eyebrow sidebar-label">YOUR WORKSPACE</p>
        <button className={`nav-item ${!activeProject ? 'active' : ''}`} onClick={() => setActiveId(null)}><span>▦</span> Cover library <span className="count">{projects.length}</span></button>
        <div className="sidebar-bottom"><span className="save-indicator" data-status={status} role="status"><span className="status-dot" />{statusText}</span><p>This browser · This device</p></div>
      </aside>
      <main className={activeProject ? 'workspace-main' : undefined}>
        <header className="topbar"><span>Personal cover studio</span><div className="toolbar-group"><button disabled={!loaded || Boolean(packageBusy)} onClick={() => importInput.current?.click()}>{packageBusy === 'import' ? 'Importing…' : 'Import project'}</button><span className="badge">EARLY BUILD</span></div></header>
        <input ref={importInput} type="file" accept=".coverproject" hidden onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void importProject(file)
          event.target.value = ''
        }} />
        {packageError && <div className="storage-error" role="alert"><p>{packageError}</p><button onClick={() => setPackageError(null)}>Dismiss</button></div>}
        {packageDownload && <p className="export-result" role="status">Backup ready: {packageDownload.filename} <a href={packageDownload.url} download={packageDownload.filename}>Save .coverproject</a></p>}
        {error && <div className="storage-error" role="alert"><p>{error}</p><button onClick={() => void store.retry()}>{loaded ? 'Retry saving' : 'Retry loading'}</button></div>}
        {!loaded ? <section className="loading-panel" aria-label="Local library"><h1>{status === 'error' ? 'Your library is unavailable.' : 'Opening your library…'}</h1><p>{status === 'error' ? 'Resolve the storage error and retry. Your existing data has not been replaced.' : 'Loading projects and artwork saved in this browser.'}</p></section> : activeProject ? <>
          <div className="editor-heading">
            <button className="back-button" onClick={() => setActiveId(null)}>← Library</button>
            <input className="project-name" aria-label="Project name" value={activeProject.name} onChange={(event) => rename(event.target.value)} />
            <span className="save-status" data-status={status}>{statusText}</span>
            <button disabled={Boolean(packageBusy)} onClick={() => void exportProject()}>{packageBusy === 'export' ? 'Preparing backup…' : 'Export project'}</button>
          </div>
          <Suspense fallback={<p className="loading-message" role="status">Opening your workspace…</p>}>
            <div className="editor-workspace">
            <Editor key={`${activeProject.id}:${history[activeProject.id]?.revision ?? 0}`} project={activeProject} assets={assets}
              initialZoom={zooms[activeProject.id]} onZoomChange={(zoom) => setZooms((current) => ({ ...current, [activeProject.id]: zoom }))}
              canUndo={history[activeProject.id]?.canUndo ?? false} canRedo={history[activeProject.id]?.canRedo ?? false}
              onUndo={() => store.undo(activeProject.id)} onRedo={() => store.redo(activeProject.id)}
              onChange={(elements, asset, group) => changeElements(activeProject.id, elements, asset, group)} />
            </div>
          </Suspense>
        </> : <div className="library">
          <div className="page-heading"><div><p className="eyebrow">THE COLLECTION STARTS HERE</p><h1>Your games.<br />Your shelf.</h1><p className="intro">Turn your artwork into covers worth keeping.<br />A little space for your collection, made by you.</p></div><button className="primary new-cover" onClick={newProject}>+ New cover</button></div>
          {projects.length > 0 && <section className="project-section" aria-label="Your covers">
            <div className="section-heading"><h2>Your covers</h2><span>{projects.length} {projects.length === 1 ? 'project' : 'projects'}</span></div>
            <div className="project-grid">{projects.map((project) => <article className="project-card" key={project.id}>
              <button className="project-preview" onClick={() => setActiveId(project.id)} aria-label={`Open ${project.name}`}><span>PC</span><strong>{project.name || 'Untitled cover'}</strong><small>SHELVER COLLECTION</small></button>
              <div className="project-meta"><button onClick={() => setActiveId(project.id)}>{project.name || 'Untitled cover'}</button><button className="duplicate-button" onClick={() => store.duplicate(project.id)} aria-label={`Duplicate ${project.name}`}>Duplicate</button></div>
              <p className="project-date">Updated {new Date(project.updatedAt).toLocaleString()}</p>
            </article>)}</div>
          </section>}
          <section aria-label="Starter template">
            <div className="section-heading"><h2>Start with a format</h2><span>01 / STARTER TEMPLATE</span></div>
            <button className="template-card" onClick={newProject}>
              <div className="template-illustration" aria-hidden="true"><div className="mini-back"><i /><i /><i /></div><div className="mini-spine" /><div className="mini-front"><span>YOUR<br />NEXT<br />ADVENTURE.</span><small>PC / STEAM</small></div></div>
              <div className="template-copy"><span className="tag">PC / STEAM</span><h3>A home for your next adventure.</h3><p>Front, spine, and back. One open canvas.<br />Bring the artwork; make the rest your own.</p><span className="template-link">Create a cover <span>↗</span></span></div>
            </button>
          </section>
          <div className="library-footer"><span className="status-dot" /><p>Projects and artwork save automatically in this browser.<br />Export a .coverproject backup to keep a portable copy with all your images.</p></div>
        </div>}
      </main>
    </div>
  )
}

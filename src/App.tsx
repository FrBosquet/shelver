import { lazy, Suspense, useState } from 'react'
import { createProject, duplicateProject, pcTemplate } from './domain/projects'
import type { Asset, Element, Project } from './domain/types'

const Editor = lazy(() => import('./editor/Editor').then((module) => ({ default: module.Editor })))

export function App() {
  const [projects, setProjects] = useState<Project[]>([])
  const [assets, setAssets] = useState<Record<string, Asset>>({})
  const [activeId, setActiveId] = useState<string | null>(null)
  const activeProject = projects.find((project) => project.id === activeId)

  function newProject() {
    const project = createProject(pcTemplate)
    setProjects((current) => [...current, project])
    setActiveId(project.id)
  }

  function changeElements(elements: Element[]) {
    setProjects((current) => current.map((project) => project.id === activeId
      ? { ...project, updatedAt: new Date().toISOString(), composition: { ...project.composition, elements } }
      : project))
  }

  function rename(name: string) {
    setProjects((current) => current.map((project) => project.id === activeId
      ? { ...project, name, updatedAt: new Date().toISOString() } : project))
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setActiveId(null) }}>
          <span className="brand-mark" aria-hidden="true">▥</span> shelver<span className="brand-dot">.</span>
        </a>
        <p className="eyebrow sidebar-label">YOUR WORKSPACE</p>
        <button className={`nav-item ${!activeProject ? 'active' : ''}`} onClick={() => setActiveId(null)}><span>▦</span> Cover library <span className="count">{projects.length}</span></button>
        <div className="sidebar-bottom"><span className="status-dot" /> Browser workspace<p>Session only · Export before closing</p></div>
      </aside>
      <main>
        <header className="topbar"><span>Personal cover studio</span><span className="badge">EARLY BUILD</span></header>
        {activeProject ? <>
          <div className="editor-heading">
            <button className="back-button" onClick={() => setActiveId(null)}>← Library</button>
            <input className="project-name" aria-label="Project name" value={activeProject.name} onChange={(event) => rename(event.target.value)} />
            <span className="session-label">Kept in this session</span>
          </div>
          <Suspense fallback={<p className="loading-message" role="status">Opening your workspace…</p>}>
            <Editor key={activeProject.id} project={activeProject} assets={assets} onChange={changeElements} onAsset={(asset) => setAssets((current) => ({ ...current, [asset.id]: asset }))} />
          </Suspense>
        </> : <div className="library">
          <div className="page-heading"><div><p className="eyebrow">THE COLLECTION STARTS HERE</p><h1>Your games.<br />Your shelf.</h1><p className="intro">Turn your artwork into covers worth keeping.<br />A little space for your collection, made by you.</p></div><button className="primary new-cover" onClick={newProject}>+ New cover</button></div>
          {projects.length > 0 && <section className="project-section" aria-label="Your covers">
            <div className="section-heading"><h2>Your covers</h2><span>{projects.length} {projects.length === 1 ? 'project' : 'projects'}</span></div>
            <div className="project-grid">{projects.map((project) => <article className="project-card" key={project.id}>
              <button className="project-preview" onClick={() => setActiveId(project.id)} aria-label={`Open ${project.name}`}><span>PC</span><strong>{project.name || 'Untitled cover'}</strong><small>SHELVER COLLECTION</small></button>
              <div className="project-meta"><button onClick={() => setActiveId(project.id)}>{project.name || 'Untitled cover'}</button><button className="duplicate-button" onClick={() => setProjects((current) => [...current, duplicateProject(project)])} aria-label={`Duplicate ${project.name}`}>Duplicate</button></div>
            </article>)}</div>
          </section>}
          <section aria-label="Starter template">
            <div className="section-heading"><h2>Start with a format</h2><span>01 / STARTER TEMPLATE</span></div>
            <button className="template-card" onClick={newProject}>
              <div className="template-illustration" aria-hidden="true"><div className="mini-back"><i /><i /><i /></div><div className="mini-spine" /><div className="mini-front"><span>YOUR<br />NEXT<br />ADVENTURE.</span><small>PC / STEAM</small></div></div>
              <div className="template-copy"><span className="tag">PC / STEAM</span><h3>A home for your next adventure.</h3><p>Front, spine, and back. One open canvas.<br />Bring the artwork; make the rest your own.</p><span className="template-link">Create a cover <span>↗</span></span></div>
            </button>
          </section>
          <div className="library-footer"><span className="status-dot" /><p>Files stay in your browser. This first build keeps projects in memory;<br />local saving and portable project backups are next.</p></div>
        </div>}
      </main>
    </div>
  )
}

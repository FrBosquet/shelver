import { useEffect, useRef } from 'react'
import type { Asset, Project } from './domain/types'
import { frontArtwork } from './domain/frontArtwork'

export function ProjectPreview({ project, assets, onOpen }: { project: Project; assets: Record<string, Asset>; onOpen: () => void }) {
  const artwork = frontArtwork(project)
  const blob = artwork && assets[artwork.assetId]?.blob
  const imageRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (!blob || !imageRef.current) return
    const url = URL.createObjectURL(blob)
    imageRef.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [blob])

  return <button className={`project-preview${blob ? ' has-artwork' : ''}`} onClick={onOpen} aria-label={`Open ${project.name}`}>
    {blob && <img ref={imageRef} className="project-preview-artwork" alt="" style={{ objectPosition: `${(artwork.focalX ?? 0.5) * 100}% ${(artwork.focalY ?? 0.5) * 100}%` }} />}
    <span>PC</span><strong>{project.name || 'Untitled cover'}</strong><small>GAME SHELVER COLLECTION</small>
  </button>
}

import { describe, expect, it } from 'vitest'
import { frontArtwork } from './frontArtwork'
import { createProject, pcTemplate } from './projects'
import { createSteamProject } from './steamTemplate'
import { composeDesign } from './composition'
import type { ImageElement } from './types'

const image = (id: string, x = 630, width = 570): ImageElement => ({ id, name: id, type: 'image', assetId: id, x, y: 0, width, height: 800, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, visible: true, locked: false })

describe('front artwork for library cards', () => {
  it('selects the largest visible image on the front of a blank cover', () => {
    const project = createProject(pcTemplate)
    project.composition.elements = [image('back', 0), image('small', 700, 100), image('main'), { ...image('hidden'), visible: false }]
    expect(frontArtwork(project)?.assetId).toBe('main')
  })

  it('uses the configured front artwork ahead of a game logo', () => {
    const project = createSteamProject()
    project.composition.design!.images.frontArt = { assetId: 'art', fit: 'cover', focalX: 0.3, focalY: 0.7 }
    project.composition.design!.images.gameLogo = { assetId: 'logo', fit: 'contain', focalX: 0.5, focalY: 0.5 }
    expect(frontArtwork(composeDesign(project))?.assetId).toBe('art')
  })

  it('keeps the plain background when only placeholder artwork exists', () => {
    expect(frontArtwork(createSteamProject())).toBeUndefined()
  })
})

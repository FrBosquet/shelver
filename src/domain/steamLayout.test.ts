import { expect, it } from 'vitest'
import { createSteamProject, workingFormats } from './steamTemplate'
import { composeDesign } from './composition'
import { validProject } from './validation'

it('reuses the Steam layout, translucent tables and icon slots with generic content', () => {
  for (const format of workingFormats) {
    const project = createSteamProject(format)
    const elements = project.composition.elements
    const features = elements.find((element) => element.blockId === 'features')!
    expect(features).toMatchObject({ type: 'table', opacity: 0.85, icons: [['clock', 'star', 'launch', 'achievements']], cells: [['horas', '%', 'MM/AA', 'MM/AA']] })
    expect(elements.find((element) => element.blockId === 'requirements')).toMatchObject({ opacity: 0.85 })
    expect(elements.find((element) => element.id.endsWith(':gallery:shot-1-caption'))!.y / format.height).toBeCloseTo(0.49053246)
    expect(elements.find((element) => element.id.endsWith(':back-publisher:publisher'))!.x / format.panels[0].width).toBeCloseTo(0.18404241)
    expect(JSON.stringify(project)).not.toMatch(/Sennaar|Rundisc|Polygon|Focus Entertainment|95%|9\.3 horas/i)
    expect(project.composition.design!.images).toEqual({})
    expect(project.composition.design!.extras).toEqual([])
    expect(composeDesign(project).composition.elements).toEqual(elements)
    expect(validProject(project)).toBe(true)
  }
})

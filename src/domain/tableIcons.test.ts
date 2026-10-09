import { expect, it } from 'vitest'
import { createSteamProject } from './steamTemplate'
import { captureDesignEdits, composeDesign } from './composition'
import { validProject } from './validation'
import { exportCoverProject, importCoverProject } from '../packages/coverProject'

it('builds Steam features as one five-column table and persists cell icons', async () => {
  const project = createSteamProject()
  const features = project.composition.elements.filter((element) => element.blockId === 'features')
  expect(features).toHaveLength(1)
  const table = features[0]
  if (table.type !== 'table') throw new Error('Expected features table')
  expect(table.cells[0]).toHaveLength(5)
  expect(table.icons).toEqual([['player', 'controller', 'achievements', 'cloud', 'languages']])
  const next = { ...table, icons: [['multiplayer', null, 'achievements', 'cloud', 'languages']] as typeof table.icons }
  const edited = captureDesignEdits(project, project.composition.elements.map((element) => element.id === table.id ? next : element))
  expect(validProject(edited)).toBe(true)
  const imported = await importCoverProject(await exportCoverProject(edited, {}))
  expect(composeDesign(imported.project).composition.elements.find((element) => element.id === table.id)).toMatchObject({ icons: next.icons })
  const bad = structuredClone(edited)
  const invalid = bad.composition.elements.find((element) => element.id === table.id)!
  if (invalid.type === 'table') invalid.icons = [['player']]
  expect(validProject(bad)).toBe(false)
})

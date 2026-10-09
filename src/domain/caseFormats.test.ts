import { describe, expect, it } from 'vitest'
import { caseFormats } from './caseFormats'
import { createSteamProject } from './steamTemplate'
import { validProject } from './validation'
import { exportCoverProject, importCoverProject } from '../packages/coverProject'

describe('physical case formats', () => {
  it.each(caseFormats)('preserves the actual print size of $id in portable backups', async (format) => {
    const project = createSteamProject(format)
    expect(validProject(project)).toBe(true)
    expect(format.width / format.printSize!.width).toBeCloseTo(300 / 25.4)
    expect(format.panels.reduce((sum, panel) => sum + panel.width, 0)).toBeCloseTo(format.width)
    expect(format.printSize!.width + 20).toBeLessThanOrEqual(297)
    expect(format.printSize!.height + 20).toBeLessThanOrEqual(210)
    const recovered = await importCoverProject(await exportCoverProject(project, {}))
    expect(recovered.project.composition.format).toEqual(format)
  })
})

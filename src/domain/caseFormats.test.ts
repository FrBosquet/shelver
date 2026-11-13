import { describe, expect, it } from 'vitest'
import { caseFormats, steamCaseFormat } from './caseFormats'
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

describe('Steam default case format', () => {
  it('uses the Switch case size, with every Steam template element inside the cover', () => {
    expect(steamCaseFormat).toMatchObject({ id: 'switch-standard', printSize: { width: 208, height: 161 } })
    const { width, height } = steamCaseFormat
    for (const element of createSteamProject(steamCaseFormat).composition.elements) {
      expect(element.x, element.id).toBeGreaterThanOrEqual(-0.5)
      expect(element.y, element.id).toBeGreaterThanOrEqual(-0.5)
      expect(element.x + element.width * (element.scaleX ?? 1), element.id).toBeLessThanOrEqual(width + 0.5)
      expect(element.y + element.height * (element.scaleY ?? 1), element.id).toBeLessThanOrEqual(height + 0.5)
    }
  })
})

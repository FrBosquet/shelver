import { describe, expect, it } from 'vitest'
import { createSteamProject, workingFormats } from './steamTemplate'
import { captureDesignEdits, composeDesign } from './composition'
import { validProject } from './validation'
import { exportCoverProject, importCoverProject } from '../packages/coverProject'

function requirements(project: ReturnType<typeof createSteamProject>) {
  const elements = project.composition.elements.filter((element) => element.blockId === 'requirements')
  expect(elements).toHaveLength(1)
  const table = elements[0]
  if (table.type !== 'table') throw new Error('Expected native table')
  return table
}

describe('Steam requirements table', () => {
  it('uses one editable table with labels and minimum/recommended columns in every format', () => {
    for (const format of workingFormats) {
      const project = createSteamProject(format)
      const table = requirements(project)
      expect(table.contentFormat).toBe('markdown')
      expect(table.cells).toHaveLength(1)
      expect(table.cells[0]).toHaveLength(2)
      expect(table.cells[0][0]).toContain('### REQUISITOS MÍNIMOS (PC)')
      expect(table.cells[0][0]).toContain('- **SO:** Windows 10 (64 bits)')
      expect(table.cells[0][1]).toContain('### REQUISITOS RECOMENDADOS (PC)')
      expect(validProject(project)).toBe(true)
    }
  })

  it('persists cell edits and added rows across composition and package export', async () => {
    const project = createSteamProject()
    const table = requirements(project)
    const editedTable = { ...table, cells: [[table.cells[0][0] + '\n- **DirectX:** 11', table.cells[0][1] + '\n- **DirectX:** 12']] }
    const edited = captureDesignEdits(project, project.composition.elements.map((element) => element.id === table.id ? editedTable : element))
    expect(requirements(composeDesign(edited)).cells).toEqual(editedTable.cells)
    const imported = await importCoverProject(await exportCoverProject(edited, {}))
    expect(requirements(composeDesign(imported.project)).cells).toEqual(editedTable.cells)
  })

  it('keeps shared style updates and carries previous text overrides into the table', () => {
    const project = createSteamProject()
    const design = project.composition.design!
    design.overrides[`${design.instanceId}:requirements:spec-0-value-0`] = { text: 'Windows 10' }
    design.styles.colors.onTechnical = '#aabbcc'
    design.styles.text.technical.size = 14
    const table = requirements(composeDesign(project))
    expect(table.cells[0][0]).toContain('- **SO:** Windows 10')
    expect(table.textColor).toBe('#aabbcc')
    expect(table.fontSize).toBe(14)
  })
})

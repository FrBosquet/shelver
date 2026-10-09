import { describe, expect, it } from 'vitest'
import { qrMatrix } from './qr'
import { createSteamProject, workingFormats } from './steamTemplate'
import { captureDesignEdits, composeDesign } from './composition'
import { validProject } from './validation'

describe('QR component', () => {
  it('generates distinct symbols with finder patterns for different URLs', () => {
    const matrix = qrMatrix('https://example.com/game')!
    expect(matrix.length).toBeGreaterThanOrEqual(21)
    expect(matrix.every((row) => row.length === matrix.length)).toBe(true)
    expect(matrix.slice(0, 7).map((row) => row.slice(0, 7).map(Number).join(''))).toEqual([
      '1111111', '1000001', '1011101', '1011101', '1011101', '1000001', '1111111',
    ])
    expect(matrix).not.toEqual(qrMatrix('https://example.com/other'))
    expect(qrMatrix('https://example.com/niño?q=你好')).not.toBeNull()
  })

  it('handles incomplete, unsupported and oversized URLs without throwing', () => {
    for (const url of ['', 'example.com', 'https://', 'javascript:alert(1)', 'ftp://example.com', `https://example.com/${'x'.repeat(2000)}`]) {
      expect(qrMatrix(url)).toBeNull()
    }
  })

  it('replaces the Steam barcode and preserves URL edits through composition and format changes', () => {
    const project = createSteamProject()
    expect(project.composition.design!.blocks.some((block) => block.kind === 'barcode')).toBe(false)
    const element = project.composition.elements.find((element) => element.type === 'qr')!
    expect(element.type).toBe('qr')
    const edited = captureDesignEdits(project, project.composition.elements.map((item) => item.id === element.id ? { ...element, type: 'qr', url: 'https://example.com/my-game' } : item))
    const restored = composeDesign(JSON.parse(JSON.stringify(edited)))
    expect(validProject(restored)).toBe(true)
    const resized = composeDesign({ ...restored, composition: { ...restored.composition, format: workingFormats[1] } })
    expect(resized.composition.elements.find((item) => item.type === 'qr')).toMatchObject({ url: 'https://example.com/my-game' })
    const invalid = structuredClone(restored)
    const qr = invalid.composition.elements.find((item) => item.type === 'qr')!
    if (qr.type === 'qr') qr.url = 'x'.repeat(2001)
    expect(validProject(invalid)).toBe(false)
  })
  it('upgrades saved barcode blocks to the default QR without changing their layout', () => {
    const project = createSteamProject()
    const design = project.composition.design!
    const block = design.blocks.find((block) => block.kind === 'qr')!
    block.id = 'barcode'
    block.kind = 'barcode'
    block.name = 'Barcode slot'
    design.images.barcode = { assetId: 'old-barcode', fit: 'contain', focalX: 0.5, focalY: 0.5 }
    design.overrides[`${design.instanceId}:barcode:placeholder`] = { text: 'OLD BARCODE' }
    const migrated = composeDesign(project)
    expect(migrated.composition.design!.blocks.find((item) => item.id === 'barcode')).toEqual({ ...block, kind: 'qr', name: 'QR code' })
    expect(migrated.composition.elements.find((item) => item.blockId === 'barcode')).toMatchObject({ type: 'qr', url: 'https://store.steampowered.com/' })
    expect(migrated.composition.design!.images.barcode).toBeUndefined()
    expect(migrated.composition.design!.overrides[`${design.instanceId}:barcode:placeholder`]).toBeUndefined()
    expect(validProject(migrated)).toBe(true)
    expect(composeDesign(migrated)).toEqual(migrated)
    expect(block.kind).toBe('barcode')
  })

})

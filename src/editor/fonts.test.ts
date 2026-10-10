import { afterEach, expect, it, vi } from 'vitest'
import { loadFont } from './fonts'

afterEach(() => { vi.unstubAllGlobals() })

it('loads both weights before resolving and shares concurrent requests', async () => {
  const links: { onload: () => void; href: string }[] = []
  const load = vi.fn().mockResolvedValue([{}])
  vi.stubGlobal('window', { setTimeout, clearTimeout })
  vi.stubGlobal('document', {
    fonts: { load },
    createElement: () => ({ remove: vi.fn() }),
    head: { append: (link: typeof links[number]) => links.push(link) },
  })
  const first = loadFont('Inter')
  expect(loadFont('Inter')).toBe(first)
  expect(links).toHaveLength(1)
  expect(links[0].href).toContain('Inter:wght@400;700')
  links[0].onload()
  await first
  expect(load.mock.calls).toEqual([['400 16px "Inter"'], ['700 16px "Inter"']])
})

it('allows retry after a CDN failure', async () => {
  const links: { onerror: () => void; onload: () => void }[] = []
  vi.stubGlobal('window', { setTimeout, clearTimeout })
  vi.stubGlobal('document', {
    fonts: { load: vi.fn().mockResolvedValue([{}]) },
    createElement: () => ({ remove: vi.fn() }),
    head: { append: (link: typeof links[number]) => links.push(link) },
  })
  const failed = loadFont('Lora')
  links[0].onerror()
  await expect(failed).rejects.toThrow('Unable to load Lora')
  const retry = loadFont('Lora')
  expect(links).toHaveLength(2)
  links[1].onload()
  await retry
})

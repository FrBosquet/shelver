import { expect, it } from 'vitest'
import { tableMarkdown } from './tableMarkdown'

it('renders headings, bullets and bold labels without Markdown markers, retaining wrapped content', () => {
  const result = tableMarkdown('### MINIMUM (PC)\n- **Processor:** Intel Core i3 / AMD FX\n- **Memory:** 4 GB')
  expect(result.text).toBe('MINIMUM (PC)\n• Processor: Intel Core i3 / AMD FX\n• Memory: 4 GB')
  expect(result.styles[0][0]).toEqual({ fontWeight: 'bold' })
  expect(result.styles[1][2]).toEqual({ fontWeight: 'bold' })
  expect(result.styles[1][13]).toBeUndefined()
})

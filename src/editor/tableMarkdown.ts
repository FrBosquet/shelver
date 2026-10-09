// Canvas-safe Markdown: headings, bullets, and inline bold/italic text.
export function tableMarkdown(source: string) {
  const styles: Record<number, Record<number, { fontWeight?: string; fontStyle?: 'italic' }>> = {}
  const text = source.split('\n').map((raw, line) => {
    const heading = /^#{1,6}\s+/.test(raw)
    const value = raw.replace(/^#{1,6}\s+/, '').replace(/^\s*[-*+]\s+/, '• ')
    let output = ''
    const lineStyles: Record<number, { fontWeight?: string; fontStyle?: 'italic' }> = {}
    const pattern = /\*\*(.+?)\*\*|__(.+?)__|\*([^*]+)\*/g
    let position = 0
    for (const match of value.matchAll(pattern)) {
      output += value.slice(position, match.index)
      const content = match[1] ?? match[2] ?? match[3]
      const style = match[3] ? { fontStyle: 'italic' as const } : { fontWeight: 'bold' }
      for (let i = 0; i < content.length; i++) lineStyles[output.length + i] = style
      output += content
      position = match.index! + match[0].length
    }
    output += value.slice(position)
    if (heading) for (let i = 0; i < output.length; i++) lineStyles[i] = { ...lineStyles[i], fontWeight: 'bold' }
    styles[line] = lineStyles
    return output
  }).join('\n')
  return { text, styles }
}

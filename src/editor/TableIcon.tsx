import { createElement } from 'react'
import { tableIcons } from '../domain/tableIcons'
import type { TableIconId } from '../domain/tableIcons'

export function TableIcon({ id, size = 24 }: { id?: TableIconId | null; size?: number }) {
  const icon = tableIcons.find((entry) => entry.id === id)
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {icon ? icon.node.map(([tag, attrs], index) => createElement(tag, { ...attrs, key: index })) : <path d="M4 4h16v16H4zM12 8v8M8 12h8" />}
  </svg>
}

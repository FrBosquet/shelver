import type { ColorRole, StyleSheet } from '../domain/types'
import { createElement } from 'react'
import { Pipette } from 'lucide'

import { colorLabels } from '../domain/colorLabels'

type Props = {
  label: string
  value: string
  colors?: StyleSheet['colors']
  onChange: (color: string, role?: ColorRole) => void
}

export function ColorPicker({ label, value, colors, onChange }: Props) {
  const customSelected = !colors || !Object.values(colors).some((color) => color.toLowerCase() === value.toLowerCase())
  const hex = value.replace('#', '')
  const brightness = (parseInt(hex.slice(0, 2), 16) * 299 + parseInt(hex.slice(2, 4), 16) * 587 + parseInt(hex.slice(4, 6), 16) * 114) / 1000
  return <span className="project-color-picker">
    {colors && <span className="project-color-palette" role="group" aria-label={`${label}: project colors`}>
      {(Object.keys(colorLabels) as ColorRole[]).map((role) => <button
        key={role}
        type="button"
        className="project-color-swatch"
        style={{ backgroundColor: colors[role] }}
        title={`${colorLabels[role]} · ${colors[role]}`}
        aria-label={`${label}: ${colorLabels[role]} (${colors[role]})`}
        aria-pressed={value.toLowerCase() === colors[role].toLowerCase()}
        onClick={() => onChange(colors[role], role)}
      />)}
    </span>}
    <span className="custom-color-swatch" data-selected={customSelected} style={customSelected ? { backgroundColor: value, color: brightness > 150 ? '#172129' : '#ffffff' } : undefined} title={`${label}: custom color (${value})`}>
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {Pipette.map(([tag, attrs], index) => createElement(tag, { ...attrs, key: index }))}
      </svg>
      <input aria-label={label} type="color" value={value} onChange={(event) => onChange(event.target.value)} />
    </span>
  </span>
}

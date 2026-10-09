import type { ColorRole, StyleSheet } from '../domain/types'

import { colorLabels } from '../domain/colorLabels'

type Props = {
  label: string
  value: string
  colors?: StyleSheet['colors']
  onChange: (color: string) => void
}

export function ColorPicker({ label, value, colors, onChange }: Props) {
  return <span className="project-color-picker">
    <input aria-label={label} type="color" value={value} onChange={(event) => onChange(event.target.value)} />
    {colors && <span className="project-color-palette" role="group" aria-label={`${label}: project colors`}>
      <span className="project-color-caption">Project colors</span>
      {(Object.keys(colorLabels) as ColorRole[]).map((role) => <button
        key={role}
        type="button"
        className="project-color-swatch"
        style={{ backgroundColor: colors[role] }}
        title={`${colorLabels[role]} · ${colors[role]}`}
        aria-label={`${label}: ${colorLabels[role]} (${colors[role]})`}
        aria-pressed={value.toLowerCase() === colors[role].toLowerCase()}
        onClick={() => onChange(colors[role])}
      />)}
    </span>}
  </span>
}

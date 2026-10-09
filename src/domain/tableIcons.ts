import { Calendar, Clock, Cloud, Gamepad2, Languages, Star, Trophy, UserRound, UsersRound } from 'lucide'

export const tableIcons = [
  { id: 'player', label: 'Single player', node: UserRound },
  { id: 'controller', label: 'Controller', node: Gamepad2 },
  { id: 'achievements', label: 'Achievements', node: Trophy },
  { id: 'cloud', label: 'Cloud saves', node: Cloud },
  { id: 'languages', label: 'Languages', node: Languages },
  { id: 'multiplayer', label: 'Multiplayer', node: UsersRound },
  { id: 'clock', label: 'Clock', node: Clock },
  { id: 'star', label: 'Star', node: Star },
  { id: 'calendar', label: 'Calendar', node: Calendar },
] as const
export type TableIconId = typeof tableIcons[number]['id']

export function tableIconSvg(icon: typeof tableIcons[number], color: string) {
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const nodes = icon.node.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([key, value]) => `${key}="${escape(String(value))}"`).join(' ')}/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><rect width="24" height="24" fill="none" stroke="none"/><g fill="none" stroke="${escape(color)}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${nodes}</g></svg>`
}

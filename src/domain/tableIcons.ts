export const tableIcons = [
  { id: 'player', label: 'Single player', path: 'M12 3a3 3 0 1 0 0 6a3 3 0 1 0 0-6M5 21v-3a7 7 0 0 1 14 0v3' },
  { id: 'controller', label: 'Controller', path: 'M7 7h10q3 0 4 4l1 7q0 3-3 2l-4-4H9l-4 4q-3 1-3-2l1-7q1-4 4-4M6 10v6M3 13h6M16 11h.01M19 14h.01' },
  { id: 'achievements', label: 'Achievements', path: 'M7 3h10v6a5 5 0 0 1-10 0V3M7 5H3v3a4 4 0 0 0 4 4M17 5h4v3a4 4 0 0 1-4 4M12 14v5M7 22h10M9 19h6v3H9z' },
  { id: 'cloud', label: 'Cloud saves', path: 'M6 19a5 5 0 0 1-1-10a7 7 0 0 1 13-2a6 6 0 0 1 0 12H6' },
  { id: 'languages', label: 'Languages', path: 'M3 3h12M9 1v2M5 6q2 8 10 10M13 3q-1 9-10 13M14 22l4-11l4 11M15 19h6' },
  { id: 'multiplayer', label: 'Multiplayer', path: 'M9 3a3 3 0 1 0 0 6a3 3 0 1 0 0-6M2 21v-3a7 7 0 0 1 14 0v3M17 3a3 3 0 0 1 0 6M19 12q4 1 4 6v3' },
  { id: 'clock', label: 'Clock', path: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 7v5l3 2' },
  { id: 'star', label: 'Star', path: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z' },
  { id: 'calendar', label: 'Calendar', path: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2M7 3v4M17 3v4M3 10h18M7 14h2M15 14h2M7 18h2M15 18h2' },
] as const
export type TableIconId = typeof tableIcons[number]['id']

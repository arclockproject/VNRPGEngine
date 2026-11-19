// The game's colours. They become the MUI palette, so every MUI part and every
// `color="primary"` / `'text.secondary'` / `'divider'` in the game uses them.
// The values below are MUI's dark defaults: change them to recolour the whole game.
import type { LookColors } from '@/core/look'

// Your own named colours, to reuse in the other look files (import { gold } from './colors').
export const cream = '#f0e6d2'
export const gold = '#f2d48a'

export default {
  text: '#fff', // normal text
  muted: 'rgba(255, 255, 255, 0.7)', // hints, captions
  disabled: 'rgba(255, 255, 255, 0.5)', // greyed-out text
  accent: '#90caf9', // primary buttons, switches that are on, sliders, spinners
  // onAccent: '#000', // text on top of the accent colour (unset = picked to be readable)
  second: '#ce93d8', // secondary buttons
  good: '#66bb6a',
  warn: '#ffa726',
  danger: '#f44336',
  info: '#29b6f6',
  divider: 'rgba(255, 255, 255, 0.12)', // thin lines
  background: '#121212', // behind everything
  surface: '#121212', // panels without a frame
} satisfies LookColors

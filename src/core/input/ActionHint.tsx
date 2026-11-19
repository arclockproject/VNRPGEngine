// A small key / button label for an action, matching the device the player uses:
// <ActionHint action="confirm" /> shows "E" on keyboard, "A" on Xbox, "✕" on PlayStation.
import { Box } from '@mui/material'
import { useSettingsStore } from '../stores/settings'
import { useSystemStore } from '../stores/system'
import type { ActionName } from './manager'
import { actionLabel } from './prompt'

export function ActionHint({ action, sx }: { action: ActionName; sx?: object }) {
  const device = useSystemStore((s) => s.device)
  const kind = useSystemStore((s) => s.gamepad)
  useSettingsStore((s) => s.bindings) // re-render after rebinding
  useSettingsStore((s) => s.confirmButton) // ...and when "Confirm with" swaps two buttons
  useSystemStore((s) => s.windows) // ...and when the pause menu / Settings opens (normal buttons there)
  const glyph = actionLabel(action, device, kind)
  if (!glyph) return null
  const round = device === 'gamepad' && glyph.label.length === 1
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '1.6em',
        height: '1.6em',
        px: round ? 0 : 0.6,
        ml: 0.75,
        borderRadius: round ? '50%' : 0.75,
        border: '1px solid currentColor',
        fontSize: '0.75em',
        fontWeight: 700,
        lineHeight: 1,
        opacity: 0.9,
        color: glyph.color ?? 'inherit',
        ...sx,
      }}
    >
      {glyph.label}
    </Box>
  )
}

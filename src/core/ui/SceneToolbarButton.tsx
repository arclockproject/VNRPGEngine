// One scene toolbar button (src/content/ui/SceneToolbar.tsx draws them). It only adds what the engine
// needs: the press runs the button's action and doesn't reach the scene behind it (a click on the
// toolbar must not also continue the text), and its name / on / disabled state for screen readers.
import { Button, type ButtonProps, type SxProps, type Theme } from '@mui/material'
import type { ReactNode } from 'react'
import type { SceneToolbarButtonId, SceneToolbarButtonInfo } from '../slots'

/** The buttons that switch something on and off (aria-pressed). */
const TOGGLES: readonly SceneToolbarButtonId[] = ['auto', 'skip', 'toChoice', 'skipBack', 'lock']

export function SceneToolbarButton({
  button,
  sx,
  children,
  ...rest
}: Omit<ButtonProps, 'onClick' | 'sx' | 'children'> & {
  button: SceneToolbarButtonInfo
  sx?: SxProps<Theme>
  /** What it shows: its label (the default), an icon, or both. */
  children?: ReactNode
}) {
  return (
    <Button
      // Extra props first (a Tooltip around it hands over its pointer / focus handlers and ref).
      {...rest}
      size="small"
      aria-label={button.label}
      aria-pressed={TOGGLES.includes(button.id) ? button.on : undefined}
      // Not `disabled`: a disabled button lets the click through to the scene (it would continue).
      aria-disabled={button.disabled || undefined}
      data-toolbar-button={button.id}
      onClick={(e) => {
        e.stopPropagation()
        if (!button.disabled) button.press()
      }}
      sx={sx}
    >
      {children ?? button.label}
    </Button>
  )
}

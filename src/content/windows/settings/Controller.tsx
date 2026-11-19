// The controller in Settings → Controls (shown while a controller is in use): the art (controller.svg)
// with every button on it, named for the controller in hand (look/glyphs.ts). Each is a button: press
// one to choose what it does (the panel under it, Controls.tsx). Buttons that do something stand out,
// the one picked is outlined, the buttons of the action pointed at in the panel light up.
// Edit freely: controller.svg is the art; BUTTONS says where each button sits on it (in the art's
// 1000 x 640 viewBox), its shape and its size.
import { alpha, Box, ButtonBase, useTheme } from '@mui/material'
import { GamepadButton as GP } from '@/core/input/define'
import { swapFace } from '@/core/input/faceSwap'
import { buttonGlyph } from '@/core/input/glyphs'
import { useSettingsStore } from '@/core/stores/settings'
import { useSystemStore } from '@/core/stores/system'
import art from './controller.svg'

type Shape = 'round' | 'bar' | 'pad'

/** Every button where it sits on the art (Xbox layout positions; other controllers use the same). */
const BUTTONS: { button: number; x: number; y: number; shape: Shape; size: number }[] = [
  { button: GP.LT, x: 260, y: 48, shape: 'bar', size: 130 },
  { button: GP.RT, x: 740, y: 48, shape: 'bar', size: 130 },
  { button: GP.LB, x: 270, y: 94, shape: 'bar', size: 170 },
  { button: GP.RB, x: 730, y: 94, shape: 'bar', size: 170 },
  { button: GP.LeftStick, x: 290, y: 250, shape: 'round', size: 52 },
  { button: GP.RightStick, x: 610, y: 385, shape: 'round', size: 52 },
  { button: GP.DpadUp, x: 390, y: 333, shape: 'pad', size: 44 },
  { button: GP.DpadDown, x: 390, y: 427, shape: 'pad', size: 44 },
  { button: GP.DpadLeft, x: 343, y: 380, shape: 'pad', size: 44 },
  { button: GP.DpadRight, x: 437, y: 380, shape: 'pad', size: 44 },
  { button: GP.Y, x: 712, y: 192, shape: 'round', size: 36 },
  { button: GP.A, x: 712, y: 308, shape: 'round', size: 36 },
  { button: GP.X, x: 654, y: 250, shape: 'round', size: 36 },
  { button: GP.B, x: 770, y: 250, shape: 'round', size: 36 },
  { button: GP.Back, x: 440, y: 240, shape: 'round', size: 24 },
  { button: GP.Start, x: 560, y: 240, shape: 'round', size: 24 },
]

const ART_W = 1000
const ART_H = 640

export function Controller(props: {
  /** Button (as the bindings mean it) -> the (translated) actions on it: those stand out. */
  bound: Record<number, string[]>
  /** The buttons of the action pointed at in the panel: lit up. */
  active: number[]
  /** The button picked (as the bindings mean it; its panel is open), or null. */
  selected: number | null
  onSelect: (button: number) => void
}) {
  const theme = useTheme()
  const kind = useSystemStore((s) => s.gamepad)
  useSettingsStore((s) => s.confirmButton) // "Confirm with" swaps two buttons: redraw
  const accent = theme.palette.primary.main
  const text = theme.palette.text.primary
  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        // At most half the game screen tall (cqh = the game screen), so the panel under it stays
        // in view on short screens.
        maxWidth: `min(720px, ${(50 * ART_W) / ART_H}cqh)`,
        mx: 'auto',
        alignSelf: 'center',
        aspectRatio: `${ART_W} / ${ART_H}`,
        containerType: 'inline-size',
      }}
    >
      <Box
        component="img"
        src={art}
        alt=""
        draggable={false}
        sx={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      />
      {BUTTONS.map(({ button: onPad, x, y, shape, size }) => {
        // The art shows the buttons where they are; bindings may mean the other face button.
        const meant = swapFace(onPad, kind)
        const actions = props.bound[meant] ?? []
        const lit = props.active.includes(meant)
        const picked = props.selected === meant
        const used = actions.length > 0
        const glyph = buttonGlyph(meant, kind)
        // In art units: round = a circle of radius size, bar = size wide, pad = a size square.
        const w = shape === 'round' ? size * 2 : size
        const h = shape === 'round' ? size * 2 : shape === 'bar' ? 40 : size
        return (
          <ButtonBase
            key={onPad}
            data-button={meant}
            aria-label={used ? `${glyph.label}: ${actions.join(', ')}` : glyph.label}
            aria-pressed={picked}
            title={used ? actions.join(', ') : undefined}
            onClick={() => props.onSelect(meant)}
            sx={{
              position: 'absolute',
              left: `${((x - w / 2) / ART_W) * 100}%`,
              top: `${((y - h / 2) / ART_H) * 100}%`,
              width: `${(w / ART_W) * 100}%`,
              height: `${(h / ART_H) * 100}%`,
              borderRadius: shape === 'round' ? '50%' : shape === 'bar' ? '1.8cqw' : '0.8cqw',
              // Words (View, Options, Create) smaller than single letters / symbols.
              fontSize:
                shape === 'bar'
                  ? '2.4cqw'
                  : glyph.label.length > 2
                    ? '1.4cqw'
                    : `${Math.max(2.2, size * 0.075)}cqw`,
              fontWeight: 700,
              color: lit ? theme.palette.getContrastText(accent) : (glyph.color ?? text),
              bgcolor: lit ? accent : used ? alpha(accent, 0.3) : alpha(text, 0.08),
              border: `${picked ? 3 : 2}px solid`,
              borderColor: picked
                ? text
                : lit || used
                  ? accent
                  : (glyph.color ?? alpha(text, 0.35)),
              '&.Mui-focusVisible, &:hover': { borderColor: text },
            }}
          >
            {glyph.label}
          </ButtonBase>
        )
      })}
    </Box>
  )
}

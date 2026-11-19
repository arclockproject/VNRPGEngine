// Every MUI Button. A button's look is built in this order, each on top of the one before:
//   all  ->  all.<variant>  ->  <colour>  ->  <colour>.<variant>
// Variants are contained / outlined / text (<Button variant="outlined">), colours are primary,
// secondary, error... (<Button color="error">). What you write straight in a look goes to all
// three variants, so one style can serve them all:
//   primary: myStyle
// or each variant can get its own, on top of it:
//   primary: { ...myStyle, contained: { color: 'white' }, text: otherStyle }
// States: focus (keyboard / pad focus and mouse hover), pressed, disabled. A missing state keeps
// the frame with a small effect (brighter, darker, grey).
import type { LookButtons } from '@/core/look'
import { cream, gold } from './colors'
import * as frames from './frames'

export default {
  all: {
    color: cream,
    focus: { ...frames.buttonFocus, color: gold },
    pressed: frames.buttonPressed,
    // contained: {...}, outlined: {...}, text: {...},
  },
  primary: { ...frames.button },
  secondary: {},
  warning: { ...frames.buttonWarning },
  error: { ...frames.buttonError },
  inherit: {},
  success: {},
  info: {},
} satisfies LookButtons

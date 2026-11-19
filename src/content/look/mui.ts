// Raw MUI theme options, merged last over everything the look builds. Use it for how parts
// BEHAVE (default props) and for styling anything the look has no setting for.
// Component names and their options: https://mui.com/material-ui/customization/theme-components/
import type { ThemeOptions } from '@mui/material/styles'

export default {
  components: {
    // Default props = behaviour of every such part, unless one sets its own.
    // MuiButton: { defaultProps: { variant: 'outlined', size: 'large' } },
    // MuiButtonBase: { defaultProps: { disableRipple: true } },   // no click ripple anywhere
    // MuiTextField: { defaultProps: { size: 'small' } },
    // Styles by MUI slot name:
    // MuiTooltip: { styleOverrides: { tooltip: { fontSize: 14 } } },
  },
} satisfies ThemeOptions

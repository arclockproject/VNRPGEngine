// Dev tool: every part of the look (src/content/look/) in one place, to check edits at a glance.
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import { type ReactNode, useState } from 'react'
import look from '@/content/look'
import { Z } from '../layers/zIndex'
import { BUTTON_COLORS, BUTTON_VARIANTS, type TextVariant } from '../look'
import { type PartName, part } from '../ui/part'
import { uiSound } from '../ui/sounds'

const TEXT: TextVariant[] = [
  'h5',
  'h6',
  'subtitle1',
  'subtitle2',
  'body1',
  'body2',
  'caption',
  'overline',
]
const PALETTE = [
  'text.primary',
  'text.secondary',
  'text.disabled',
  'primary.main',
  'secondary.main',
  'success.main',
  'warning.main',
  'error.main',
  'info.main',
  'divider',
  'background.default',
  'background.paper',
]
// Forces the focus look without focusing the element.
const FOCUS = 'Mui-focusVisible'

function Section(props: { title: string; file: string; children: ReactNode }) {
  return (
    <Box>
      <Typography variant="overline" sx={{ display: 'block', opacity: 0.7 }}>
        {props.title} · look/{props.file}
      </Typography>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
        {props.children}
      </Stack>
    </Box>
  )
}

export function LookGallery(props: { onClose: () => void }) {
  const [tab, setTab] = useState(0)
  const [choice, setChoice] = useState('one')
  const names = Object.keys(look.parts) as PartName[]
  return (
    <Paper
      sx={{
        position: 'absolute',
        top: 16,
        left: 16,
        bottom: 16,
        width: 'max(300px, calc(100cqw - 408px))',
        zIndex: Z.dev,
        p: 2,
        overflow: 'auto',
      }}
    >
      <Stack spacing={2}>
        <Stack direction="row" sx={{ alignItems: 'center' }}>
          <Typography variant="h6" sx={{ flex: 1 }}>
            Look gallery
          </Typography>
          <Button size="small" onClick={props.onClose}>
            Close
          </Button>
        </Stack>
        <Typography variant="caption">
          Rows of buttons: normal, focus (forced), disabled. Hover and press them to see the rest.
        </Typography>

        <Section title="Colours" file="colors.ts">
          {PALETTE.map((name) => (
            <Stack key={name} sx={{ alignItems: 'center', width: 84 }}>
              <Box
                sx={{ width: 32, height: 32, bgcolor: name, border: 1, borderColor: 'divider' }}
              />
              <Typography variant="caption" noWrap>
                {name}
              </Typography>
            </Stack>
          ))}
        </Section>

        <Section title="Text" file="text.ts">
          {TEXT.map((variant) => (
            <Typography key={variant} variant={variant}>
              {variant}
            </Typography>
          ))}
        </Section>

        {BUTTON_VARIANTS.map((variant) => (
          <Section key={variant} title={`Buttons: ${variant}`} file="buttons.ts">
            {BUTTON_COLORS.map((color) => (
              <Stack key={color} spacing={0.5}>
                <Button variant={variant} color={color}>
                  {color}
                </Button>
                <Button variant={variant} color={color} className={FOCUS} tabIndex={-1}>
                  focus
                </Button>
                <Button variant={variant} color={color} disabled>
                  disabled
                </Button>
              </Stack>
            ))}
          </Section>
        ))}

        <Section title="Named parts as Button variant" file="parts.ts">
          {names.map((name) => (
            <Stack key={name} spacing={0.5}>
              <Button variant={name}>{name}</Button>
              <Button variant={name} className={FOCUS} tabIndex={-1}>
                focus
              </Button>
              <Button variant={name} disabled>
                disabled
              </Button>
            </Stack>
          ))}
        </Section>

        <Section title="Named parts with sx={part('name')}" file="parts.ts">
          {names.map((name) => (
            <Box
              key={name}
              sx={{
                minWidth: 56,
                minHeight: 56,
                display: 'grid',
                placeItems: 'center',
                px: 1,
                ...part(name),
              }}
            >
              <Typography variant="caption">{name}</Typography>
            </Box>
          ))}
        </Section>

        <Section title="Panels" file="index.ts">
          <Paper sx={{ p: 2 }}>panel</Paper>
          <Paper elevation={8} sx={{ p: 2 }}>
            panel, raised
          </Paper>
          <Alert severity="info">alert</Alert>
          <Alert severity="error">alert, error</Alert>
        </Section>

        <Section title="Tabs, dropdown, text field" file="index.ts">
          <Tabs value={tab} onChange={(_, value: number) => setTab(value)}>
            <Tab label="One" />
            <Tab label="Two" />
            <Tab label="Off" disabled />
          </Tabs>
          <Select size="small" value={choice} onChange={(e) => setChoice(e.target.value)}>
            <MenuItem value="one">Dropdown one</MenuItem>
            <MenuItem value="two">Dropdown two</MenuItem>
            <MenuItem value="three" disabled>
              Disabled
            </MenuItem>
          </Select>
          <TextField size="small" label="Text field" defaultValue="text" />
        </Section>

        <Section title="Slider, switch, bars" file="index.ts">
          <Slider defaultValue={40} sx={{ width: 160 }} />
          <Slider defaultValue={40} disabled sx={{ width: 100 }} />
          <FormControlLabel control={<Switch defaultChecked />} label="On" />
          <FormControlLabel control={<Switch />} label="Off" />
          <FormControlLabel control={<Switch disabled />} label="Disabled" />
          <LinearProgress variant="determinate" value={60} sx={{ width: 160 }} />
          <CircularProgress size={28} />
        </Section>

        <Section title="Small parts" file="index.ts">
          <Chip label="chip" />
          <Chip label="clickable chip" onClick={() => {}} />
          <Avatar>A</Avatar>
          <IconButton>✕</IconButton>
          <IconButton className={FOCUS} tabIndex={-1}>
            ✕
          </IconButton>
          <IconButton disabled>✕</IconButton>
        </Section>

        <Section title="Sounds (click to hear)" file="sounds.ts">
          {Object.keys(look.sounds ?? {}).map((name) => (
            <Button key={name} size="small" data-sound="none" onClick={() => uiSound(name)}>
              {name}
            </Button>
          ))}
        </Section>
      </Stack>
    </Paper>
  )
}

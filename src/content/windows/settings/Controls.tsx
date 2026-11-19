// Key / button settings (part of the Settings window). Bindings are saved in the settings.
// A picture of the device in use (Keyboard.tsx / Controller.tsx): press a key or button on it, then
// pick in the panel under it what it does. On a controller the menu button (padLocked in
// src/content/config/input.ts) can't be changed; in the pause menu and here, moving, confirm and
// cancel always use their normal buttons (padResetInMenus), so a player can't lock themselves out.
import { Box, Button, Chip, Stack, Typography } from '@mui/material'
import { useState } from 'react'
import { buttonGlyph, keyLabel } from '@/core/input/glyphs'
import { type ActionName, input, isLockedButton } from '@/core/input/manager'
import { tx, useLang } from '@/core/lang'
import { useSettingsStore } from '@/core/stores/settings'
import { useSystemStore } from '@/core/stores/system'
import { Controller } from './Controller'
import { Keyboard } from './Keyboard'
import { put, SettingSelect } from './parts'

/** Shown names of the actions in src/content/config/input.ts (typed: a new action needs a name here). */
const ACTION_NAMES: Record<ActionName, string> = {
  up: tx('Up'),
  down: tx('Down'),
  left: tx('Left'),
  right: tx('Right'),
  confirm: tx('Confirm'),
  cancel: tx('Cancel'),
  menu: tx('Menu'),
  inventory: tx('Inventory'),
  skip: tx('Skip (hold)'),
  back: tx('Back one line'),
  auto: tx('Auto-play'),
  log: tx('Log'),
  hide: tx('Hide the text box'),
  tabPrev: tx('Previous tab'),
  tabNext: tx('Next tab'),
  quickSave: tx('Quick save'),
  quickLoad: tx('Quick load'),
  screenshot: tx('Screenshot'),
  fullscreen: tx('Fullscreen'),
}
const actionTitle = (action: ActionName) => ACTION_NAMES[action]

type Picked = { kind: 'key'; code: string } | { kind: 'button'; index: number }

/** Turns one action on or off for a key / button (the other keys / buttons of it stay). */
function toggle(action: ActionName, picked: Picked) {
  const { keys = [], buttons = [] } = input.bindings(action)
  if (picked.kind === 'key') {
    const next = keys.includes(picked.code)
      ? keys.filter((k) => k !== picked.code)
      : [...keys, picked.code]
    input.setBinding(action, { keys: next, buttons })
  } else {
    const next = buttons.includes(picked.index)
      ? buttons.filter((b) => b !== picked.index)
      : [...buttons, picked.index]
    input.setBinding(action, { keys, buttons: next })
  }
}

/** What a picked key / button does: every action as a chip, on = it does that. */
function ActionPanel(props: { picked: Picked; onPoint: (action: ActionName | null) => void }) {
  const t = useLang()
  const kind = useSystemStore((s) => s.gamepad)
  const { picked } = props
  const locked = picked.kind === 'button' && isLockedButton(picked.index)
  const name = picked.kind === 'key' ? keyLabel(picked.code) : buttonGlyph(picked.index, kind).label
  return (
    <Stack spacing={1} sx={{ pt: 0.5 }}>
      <Typography variant="body2">
        {picked.kind === 'key'
          ? t('What the key {key} does:', { key: name })
          : t('What the button {button} does:', { button: name })}
      </Typography>
      {locked && (
        <Typography variant="caption" color="text.secondary">
          {t('This button always opens the menu, so Settings can always be reached.')}
        </Typography>
      )}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {input.actions().map((action) => {
          const binding = input.bindings(action)
          const on =
            picked.kind === 'key'
              ? (binding.keys ?? []).includes(picked.code)
              : (binding.buttons ?? []).includes(picked.index)
          // On a controller the menu's button can't move, and no other action can take it.
          const fixed =
            picked.kind === 'button' && (locked || input.defaultBindings(action).padLocked === true)
          return (
            <Chip
              key={action}
              label={t(actionTitle(action))}
              color={on ? 'primary' : 'default'}
              variant={on ? 'filled' : 'outlined'}
              disabled={fixed}
              aria-pressed={on}
              onClick={() => toggle(action, picked)}
              onFocus={() => props.onPoint(action)}
              onPointerEnter={() => props.onPoint(action)}
              onPointerLeave={() => props.onPoint(null)}
              onBlur={() => props.onPoint(null)}
            />
          )
        })}
      </Box>
    </Stack>
  )
}

export function Controls() {
  const t = useLang()
  const custom = useSettingsStore((s) => s.bindings)
  const confirmButton = useSettingsStore((s) => s.confirmButton)
  const device = useSystemStore((s) => s.device)
  const pad = device === 'gamepad'
  const [picked, setPicked] = useState<Picked | null>(null)
  const [pointed, setPointed] = useState<ActionName | null>(null)
  // A key picked with the keyboard means nothing once a controller is in hand, and back.
  const shown = picked && (picked.kind === 'button') === pad ? picked : null

  // What is on each key / button, for the picture.
  const keysUsed: Record<string, string[]> = {}
  const buttonsUsed: Record<number, string[]> = {}
  for (const action of input.actions()) {
    const binding = input.bindings(action)
    const name = t(actionTitle(action))
    for (const key of binding.keys ?? []) keysUsed[key] = [...(keysUsed[key] ?? []), name]
    for (const button of binding.buttons ?? [])
      buttonsUsed[button] = [...(buttonsUsed[button] ?? []), name]
  }
  const lit = pointed ? input.bindings(pointed) : {}
  // Actions the player left without any key / button that had one by default.
  const unset = input.actions().filter((action) => {
    const now = input.bindings(action)
    const was = input.defaultBindings(action)
    return pad
      ? (was.buttons ?? []).length > 0 && (now.buttons ?? []).length === 0
      : (was.keys ?? []).length > 0 && (now.keys ?? []).length === 0
  })

  return (
    <Stack spacing={1}>
      <Stack direction="row" sx={{ alignItems: 'center' }}>
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          {pad
            ? t('Press a button to choose what it does.')
            : t('Press a key to choose what it does.')}
        </Typography>
        <Button
          size="small"
          disabled={Object.keys(custom).length === 0}
          onClick={() => input.resetBindings()}
        >
          {t('Reset all')}
        </Button>
      </Stack>
      {pad ? (
        <Controller
          bound={buttonsUsed}
          active={lit.buttons ?? []}
          selected={shown?.kind === 'button' ? shown.index : null}
          onSelect={(index) => setPicked({ kind: 'button', index })}
        />
      ) : (
        <Keyboard
          bound={keysUsed}
          active={lit.keys ?? []}
          selected={shown?.kind === 'key' ? shown.code : null}
          onSelect={(code) => setPicked({ kind: 'key', code })}
        />
      )}
      {shown && <ActionPanel picked={shown} onPoint={setPointed} />}
      {unset.length > 0 && (
        <Typography variant="caption" color="warning.main">
          {t('Not set: {actions}', { actions: unset.map((a) => t(actionTitle(a))).join(', ') })}
        </Typography>
      )}
      {pad && (
        <>
          <Typography variant="caption" color="text.secondary">
            {t(
              'In the pause menu and here, moving, confirm and cancel always use their normal buttons.',
            )}
          </Typography>
          {/* Nintendo controllers confirm with the right face button: Automatic does that for them. */}
          <SettingSelect
            label={t('Confirm with (controller)')}
            value={confirmButton}
            onChange={put('confirmButton')}
            options={[
              { value: 'auto', label: t('Automatic (right button on Nintendo controllers)') },
              { value: 'bottom', label: t('Bottom button') },
              { value: 'right', label: t('Right button') },
            ]}
          />
        </>
      )}
    </Stack>
  )
}

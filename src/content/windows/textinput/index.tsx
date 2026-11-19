// The window behind game.dialog.prompt() and the event command input(): one line of text.
// PC and phone: the system keyboard does the job (type and press Enter / Done). Controller only:
// the keys below are shown (A types, B deletes). Edit freely: it is game content.
import { Box, Button, Stack, TextField, Typography } from '@mui/material'
import { useEffect, useRef, useState } from 'react'
import { defineWindow, type WindowProps } from '@/core/define'
import { useAction } from '@/core/input/useAction'
import { useLang } from '@/core/lang'
import type { TextInputParams } from '@/core/managers/dialog'
import { useSettingsStore } from '@/core/stores/settings'
import { useSystemStore } from '@/core/stores/system'

/** A gap in a row of keys (an empty cell). */
const GAP = '　'
/** The key that changes the last letter: plain → ゛ → ゜ → small → plain (か→が, は→ば→ぱ, つ→っ→づ). */
const KANA_MARK = '゛'

/**
 * On-screen keys per language (the folder name in src/content/lang), one string per row.
 * `upper` is what the shift key shows (capitals; katakana for Japanese). `capitalFirst`: the
 * first letter starts on `upper` (names), then it switches back. Default true.
 */
const KEYS: Record<string, { lower: string[]; upper: string[]; capitalFirst?: boolean }> = {
  default: {
    lower: ['1234567890', 'qwertyuiop', "asdfghjkl'", 'zxcvbnm-.!'],
    upper: ['1234567890', 'QWERTYUIOP', "ASDFGHJKL'", 'ZXCVBNM-.?'],
  },
  pl: {
    lower: ['1234567890', 'qwertyuiop', "asdfghjkl'", 'zxcvbnm-.!', 'ąćęłńóśźż'],
    upper: ['1234567890', 'QWERTYUIOP', "ASDFGHJKL'", 'ZXCVBNM-.?', 'ĄĆĘŁŃÓŚŹŻ'],
  },
  ja: {
    lower: [
      '１２３４５６７８９０',
      'あいうえおかきくけこ',
      'さしすせそたちつてと',
      'なにぬねのはひふへほ',
      'まみむめもや　ゆ　よ',
      'らりるれろわ　を　ん',
      '゛ー、。！？',
    ],
    upper: [
      '１２３４５６７８９０',
      'アイウエオカキクケコ',
      'サシスセソタチツテト',
      'ナニヌネノハヒフヘホ',
      'マミムメモヤ　ユ　ヨ',
      'ラリルレロワ　ヲ　ン',
      '゛ー、。！？',
    ],
    capitalFirst: false,
  },
}

/** Hiragana that change with KANA_MARK, each group in cycle order. Katakana follow the same groups. */
const KANA_GROUPS = [
  'あぁ',
  'いぃ',
  'うぅゔ',
  'えぇ',
  'おぉ',
  'かが',
  'きぎ',
  'くぐ',
  'けげ',
  'こご',
  'さざ',
  'しじ',
  'すず',
  'せぜ',
  'そぞ',
  'ただ',
  'ちぢ',
  'つっづ',
  'てで',
  'とど',
  'はばぱ',
  'ひびぴ',
  'ふぶぷ',
  'へべぺ',
  'ほぼぽ',
  'やゃ',
  'ゆゅ',
  'よょ',
  'わゎ',
]
const KANA_NEXT = new Map<string, string>()
for (const group of KANA_GROUPS) {
  for (const shift of [0, 0x60]) {
    // Katakana sit 0x60 after their hiragana.
    const chars = [...group].map((c) => String.fromCodePoint((c.codePointAt(0) ?? 0) + shift))
    chars.forEach((c, i) => {
      KANA_NEXT.set(c, chars[(i + 1) % chars.length] as string)
    })
  }
}

/** The next form of the last letter (か→が→か), or the text unchanged. */
function cycleLastKana(text: string): string {
  const chars = [...text]
  const next = KANA_NEXT.get(chars.at(-1) ?? '')
  return next ? [...chars.slice(0, -1), next].join('') : text
}
const DEFAULT_MAX = 16

const KEY_SX = { minWidth: 0, px: 0, py: 0.5, textTransform: 'none', fontSize: '1rem' } as const

function TextInput({ params }: WindowProps<TextInputParams>) {
  const t = useLang()
  const max = params.maxLength ?? DEFAULT_MAX
  const [value, setValue] = useState((params.default ?? '').slice(0, max))
  const device = useSystemStore((s) => s.device)
  const language = useSettingsStore((s) => s.language)
  const layout = KEYS[language] ?? (KEYS.default as (typeof KEYS)[string])
  const capitalFirst = layout.capitalFirst ?? true
  const [upper, setUpper] = useState(capitalFirst && value.length === 0)
  // On-screen keys are for a controller only: a keyboard or a phone types
  // with its own keyboard.
  const keys = device === 'gamepad'
  const field = useRef<HTMLInputElement>(null)
  const cancellable = params.cancellable ?? true

  // Keyboard and phone: the field is ready to type in (a phone opens its keyboard).
  useEffect(() => {
    if (useSystemStore.getState().device !== 'gamepad') field.current?.focus()
  }, [])

  const type = (char: string) => {
    if (char === KANA_MARK) return setValue(cycleLastKana)
    setValue((v) => (v + char).slice(0, max))
    // Names: capital first, then small letters.
    if (capitalFirst && upper && value.length === 0) setUpper(false)
  }
  const erase = () => {
    // Back to an empty field: the next letter is a capital again.
    if (capitalFirst && [...value].length <= 1) setUpper(true)
    setValue((v) => [...v].slice(0, -1).join(''))
  }
  const submit = () => params.answer(value)

  // Controller B (and Backspace outside the field) deletes; with nothing left it cancels.
  useAction('cancel', (e) => {
    if (e.source === 'key:Escape' || value.length === 0) {
      if (cancellable) params.answer(null)
      return true
    }
    erase()
    return true
  })
  useAction('menu', () => true)

  const rows = upper ? layout.upper : layout.lower
  const columns = Math.max(...rows.map((row) => [...row].length))

  return (
    <Stack spacing={1.5}>
      <Typography>{params.message}</Typography>
      <TextField
        inputRef={field}
        size="small"
        fullWidth
        value={value}
        placeholder={params.placeholder}
        autoComplete="off"
        onChange={(e) => setValue(e.target.value.slice(0, max))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            submit()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            if (cancellable) params.answer(null)
            else field.current?.blur()
          }
        }}
        slotProps={{
          htmlInput: {
            maxLength: max,
            'aria-label': params.message,
            enterKeyHint: 'done',
            spellCheck: false,
          },
        }}
      />
      <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right' }}>
        {[...value].length} / {max}
      </Typography>
      {keys && (
        <Stack spacing={0.5}>
          {rows.map((row) => (
            <Box
              key={row}
              sx={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 0.5 }}
            >
              {[...row].map((char, index) =>
                char === GAP ? (
                  // biome-ignore lint/suspicious/noArrayIndexKey: a gap has no other name
                  <Box key={index} />
                ) : char === KANA_MARK ? (
                  <Button
                    key={char}
                    variant="outlined"
                    sx={{ ...KEY_SX, fontSize: '0.8rem' }}
                    aria-label={t('Change the last letter (゛ ゜ small)')}
                    onClick={() => type(char)}
                  >
                    ゛゜小
                  </Button>
                ) : (
                  <Button key={char} variant="outlined" sx={KEY_SX} onClick={() => type(char)}>
                    {char}
                  </Button>
                ),
              )}
            </Box>
          ))}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 0.5 }}>
            <Button
              variant={upper ? 'contained' : 'outlined'}
              sx={KEY_SX}
              aria-label={t('Capital letters')}
              onClick={() => setUpper((u) => !u)}
            >
              ⇧
            </Button>
            <Button variant="outlined" sx={KEY_SX} onClick={() => type(' ')}>
              {t('Space')}
            </Button>
            <Button variant="outlined" sx={KEY_SX} aria-label={t('Delete')} onClick={erase}>
              ⌫
            </Button>
          </Box>
        </Stack>
      )}
      <Stack direction="row" spacing={1}>
        {cancellable && (
          <Button variant="outlined" fullWidth onClick={() => params.answer(null)}>
            {t('Cancel')}
          </Button>
        )}
        <Button variant="contained" fullWidth onClick={submit}>
          {t('OK')}
        </Button>
      </Stack>
    </Stack>
  )
}

export default defineWindow<TextInputParams>({
  title: 'Enter text',
  component: TextInput,
  width: 460,
  modal: true,
  // The ✕ would let the player leave a question that needs an answer: Cancel is in the window.
  closable: false,
})

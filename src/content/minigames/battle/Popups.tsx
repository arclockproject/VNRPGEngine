import { Box } from '@mui/material'
import type { LogEntry } from '@/core/battle/engine'
import type { useLang } from '@/core/lang'
import { floatUp, POPUP_MS, type Popup } from './animations'

// Colours of the floating numbers.
const TONES: Record<Popup['tone'], string> = {
  damage: '#fff',
  heal: '#81c784',
  mp: '#64b5f6',
  crit: '#ffb74d',
  weak: '#ffee58',
  muted: '#b0bec5',
}

/** Battle log entries -> what floats over the fighters (ids start at `firstId`). */
export function popupsFrom(
  t: ReturnType<typeof useLang>,
  entries: LogEntry[],
  firstId: number,
): Popup[] {
  const list: Omit<Popup, 'id'>[] = []
  for (const e of entries) {
    if (e.kind === 'damage') {
      if (e.rate === 'immune') list.push({ key: e.targetKey, text: t('Immune'), tone: 'muted' })
      else list.push({ key: e.targetKey, text: `${e.amount}`, tone: e.crit ? 'crit' : 'damage' })
      if (e.crit) list.push({ key: e.targetKey, text: t('Crit!'), tone: 'crit' })
      if (e.rate === 'weak') list.push({ key: e.targetKey, text: t('Weak!'), tone: 'weak' })
      if (e.rate === 'resist') list.push({ key: e.targetKey, text: t('Resist'), tone: 'muted' })
    } else if (e.kind === 'miss') {
      list.push({ key: e.targetKey, text: t('Miss'), tone: 'muted' })
    } else if (e.kind === 'heal' || e.kind === 'revive') {
      const mp = e.kind === 'heal' && e.pool === 'mp'
      list.push({ key: e.targetKey, text: `+${e.amount}`, tone: mp ? 'mp' : 'heal' })
    } else if (e.kind === 'tick') {
      const tone = e.amount > 0 ? (e.pool === 'mp' ? 'mp' : 'heal') : 'damage'
      list.push({ key: e.targetKey, text: e.amount > 0 ? `+${e.amount}` : `${-e.amount}`, tone })
    } else if (e.kind === 'status' && e.resisted) {
      list.push({ key: e.targetKey, text: t('Resist'), tone: 'muted' })
    }
  }
  return list.map((p, i) => ({ ...p, id: firstId + i }))
}

/** The popups of one fighter, stacked above its figure. Put it in a `position: relative` box. */
export function Popups({ popups }: { popups: Popup[] }) {
  return (
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: '70%',
        display: 'flex',
        flexDirection: 'column-reverse',
        alignItems: 'center',
        pointerEvents: 'none',
        zIndex: 2,
      }}
    >
      {popups.map((p, i) => (
        <Box
          key={p.id}
          sx={{
            color: TONES[p.tone],
            fontWeight: 800,
            fontSize: p.tone === 'damage' || p.tone === 'heal' || /\d/.test(p.text) ? 24 : 15,
            lineHeight: 1.1,
            whiteSpace: 'nowrap',
            textShadow: '0 0 3px #000, 0 2px 2px #000, 1px 0 0 #000, -1px 0 0 #000',
            opacity: 0,
            animation: `${floatUp} ${POPUP_MS}ms ${i * 90}ms ease-out forwards`,
          }}
        >
          {p.text}
        </Box>
      ))}
    </Box>
  )
}

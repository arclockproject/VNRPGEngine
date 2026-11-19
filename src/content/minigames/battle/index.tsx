// The battle screen: game.battles.start({ enemies: ['slime'] }) opens it. Rules live in the engine
// (core/battle/engine.ts); this folder is only the look and the menus. Edit freely.
//   index.tsx        the screen: turn flow, focus, layout
//   TurnStrip.tsx    who acts next (top of the screen)
//   Stage.tsx        enemies (left) and party (right) standing on the background
//   CommandMenu.tsx  Attack / Skills / Items / Defend / Check / Run, target picking, the result
//   MemberCard.tsx   party status cards (HP/MP/statuses)
//   Figure.tsx       one fighter's sprite + shadow (EnemyView / PartyFigure wrap it)
//   Popups.tsx       numbers and words floating over fighters (damage, Miss, Weak!…)
//   StatusIcons.tsx  the little status icons with turns left
//   animations.ts    hurt / lunge moves for sprites without those tags, popup timing
//   describe.ts      battle log entry -> text
import { Box, Stack, Typography, useMediaQuery } from '@mui/material'
import { useEffect, useReducer, useRef, useState } from 'react'
import type { Action, Fighter, Outcome } from '@/core/battle/engine'
import { type BattleTarget, defineMinigame, type MinigameProps } from '@/core/define'
import { game } from '@/core/game'
import { useAction } from '@/core/input/useAction'
import { useLang } from '@/core/lang'
import type { BattleParams } from '@/core/managers/battles'
import { POPUP_MS, type Popup, type Reaction } from './animations'
import { CommandMenu, type Menu } from './CommandMenu'
import { describe } from './describe'
import { MemberCard } from './MemberCard'
import { popupsFrom } from './Popups'
import { Stage } from './Stage'
import { TurnStrip } from './TurnStrip'

/** Pause before an enemy (or someone asleep, confused…) acts. */
const ENEMY_DELAY_MS = 700
/** How many past actions the text under the stage keeps. */
const LOG_LINES = 2

function BattleScreen({ params, finish }: MinigameProps<BattleParams, Outcome>) {
  const t = useLang()
  const { battle, rewards } = params
  const [, redraw] = useReducer((n: number) => n + 1, 0)
  const [menu, setMenu] = useState<Menu>({ kind: 'main' })
  const [lines, setLines] = useState<{ id: number; text: string }[]>([])
  const [popups, setPopups] = useState<Popup[]>([])
  /** Turn order preview for the skill button that has focus. */
  const [focusDelay, setFocusDelay] = useState<number | undefined>(undefined)
  /** Fighter key -> its latest reaction (hurt / attack); the counter restarts it. */
  const [reactions, setReactions] = useState<Record<string, Reaction>>({})
  const small = useMediaQuery('(max-width: 600px), (max-height: 500px)')
  const scale = small ? Math.max(2, Math.round(params.spriteScale * 0.6)) : params.spriteScale
  const current = battle.current()
  const menuRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const currentKey = current?.key
  // Asleep, stunned, confused: the engine says what happens (battle.forced()).
  const forced = current ? battle.forced() : null
  const playerTurn = current?.side === 'party' && !forced
  const turn = battle.turn

  const run = (action: Action) => {
    const actor = battle.current()
    const entries = battle.act(action)
    const firstId = battle.log.length - entries.length
    const hurtNow = new Set<string>()
    for (const e of entries)
      if (
        (e.kind === 'damage' || e.kind === 'tick') &&
        e.amount !== 0 &&
        (e.kind !== 'tick' || e.amount < 0)
      )
        hurtNow.add(e.targetKey)
    if (hurtNow.size) game.audio.sfx('sfx/hit')
    const attacked = actor && (action.kind === 'attack' || action.kind === 'skill')
    if (hurtNow.size || attacked) {
      setReactions((r) => {
        const next = { ...r }
        const bump = (key: string, state: Reaction['state']) => {
          next[key] = { state, n: (r[key]?.n ?? 0) + 1 }
        }
        if (attacked) bump(actor.key, 'attack')
        for (const key of hurtNow) bump(key, 'hurt')
        return next
      })
    }
    const fresh = popupsFrom(t, entries, firstId)
    if (fresh.length) {
      setPopups((p) => [...p, ...fresh])
      const ids = new Set(fresh.map((p) => p.id))
      setTimeout(() => setPopups((p) => p.filter((x) => !ids.has(x.id))), POPUP_MS + 600)
    }
    // One paragraph per action: "Anna uses Fire! Slime A takes 8 damage. It's a weak spot!"
    const text = entries
      .map((e) => describe(t, battle, e))
      .filter(Boolean)
      .join(' ')
    if (text) setLines((l) => [...l, { id: firstId, text }].slice(-LOG_LINES))
    setFocusDelay(undefined)
    setMenu({ kind: 'main' })
    redraw()
  }

  // Focus what the player will most likely press: Attack, a target, or the result's Continue.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const focusFirst = (el: Element | null | undefined) =>
      (el as HTMLElement | null)?.focus({ focusVisible: true } as FocusOptions)
    if (battle.outcome) {
      focusFirst(root.querySelector('[data-continue]'))
      return
    }
    if ((menu.kind === 'target' || menu.kind === 'check') && currentKey) {
      const targets = [...root.querySelectorAll<HTMLElement>('[data-fighter]')]
      // Healing or buffing: start on yourself, if you are a valid target.
      const self =
        menu.kind === 'target' && menu.target === 'ally'
          ? targets.find((el) => el.dataset.fighter === currentKey)
          : undefined
      focusFirst(self ?? targets[0])
      return
    }
    if (menu.kind !== 'target' && menu.kind !== 'check' && playerTurn) {
      focusFirst(menuRef.current?.querySelector('button:not([disabled])'))
    }
  }, [menu, currentKey, playerTurn, battle.outcome])

  // Enemies, and anyone who can't choose (asleep, confused), act on their own after a short pause.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once per turn; `run` is new every render
  useEffect(() => {
    const actor = battle.current()
    if (!actor) return
    const auto = actor.side === 'enemy' || battle.forced() !== null
    if (!auto) return
    const timer = setTimeout(
      () =>
        run(actor.side === 'enemy' ? battle.enemyAction() : (battle.forced() ?? { kind: 'skip' })),
      ENEMY_DELAY_MS,
    )
    return () => clearTimeout(timer)
  }, [battle, turn])

  // Cancel goes back one menu.
  useAction('cancel', () => {
    if (menu.kind === 'main') return false
    setMenu({ kind: 'main' })
  })

  const choose = (
    target: BattleTarget,
    make: (target: string) => Action,
    delay?: number,
    note?: string,
  ) => {
    if (!current) return
    // Single targets: pick one. "All" and "self": no need to pick.
    if (target === 'enemy' || target === 'ally' || target === 'fallen_ally')
      setMenu({ kind: 'target', target, make, delay, note })
    else run(make(current.key))
  }
  const picking = menu.kind === 'target' ? menu : null
  const pickable = (f: Fighter) => {
    // Check: anyone, on either side, standing or not.
    if (menu.kind === 'check') return () => setMenu({ kind: 'info', key: f.key })
    return picking && current && battle.targets(current, picking.target).includes(f)
      ? () => run(picking.make(f.key))
      : undefined
  }
  const previewDelay =
    menu.kind === 'target' ? menu.delay : menu.kind === 'skills' ? focusDelay : undefined

  return (
    <Box
      ref={rootRef}
      sx={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        background: params.background,
        color: '#fff',
        p: small ? 1 : 2,
      }}
    >
      <TurnStrip
        battle={battle}
        previewDelay={playerTurn ? previewDelay : undefined}
        small={small}
      />
      <Stage
        battle={battle}
        reactions={reactions}
        popups={popups}
        scale={scale}
        pickable={pickable}
      />

      {/* What just happened */}
      <Box
        sx={{
          minHeight: small ? 24 : 72,
          mb: 1,
          textAlign: 'center',
          textShadow: '0 1px 3px #000',
          fontSize: small ? 13 : undefined,
        }}
      >
        {(small ? lines.slice(-1) : lines).map((line, i, shown) => (
          <Typography
            key={line.id}
            sx={{ fontSize: 'inherit', opacity: i === shown.length - 1 ? 1 : 0.6 }}
          >
            {line.text}
          </Typography>
        ))}
      </Box>

      {/* Party + commands */}
      <Stack
        direction="row"
        spacing={small ? 1 : 2}
        sx={{ alignItems: 'flex-end', justifyContent: 'center' }}
      >
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          sx={{ flexWrap: 'wrap', alignItems: 'flex-end' }}
        >
          {battle.side('party', false).map((member) => (
            <MemberCard
              key={member.key}
              battle={battle}
              small={small}
              member={member}
              active={member.key === current?.key}
              hitKey={reactions[member.key]?.state === 'hurt' ? (reactions[member.key]?.n ?? 0) : 0}
              onPick={pickable(member)}
            />
          ))}
        </Stack>

        <CommandMenu
          battle={battle}
          rewards={rewards}
          menu={menu}
          setMenu={setMenu}
          run={run}
          choose={choose}
          preview={setFocusDelay}
          small={small}
          finish={finish}
          menuRef={menuRef}
        />
      </Stack>
    </Box>
  )
}

export default defineMinigame<BattleParams, Outcome>({ component: BattleScreen })

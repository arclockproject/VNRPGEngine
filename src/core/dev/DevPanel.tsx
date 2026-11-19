// Dev builds only: run any content, inspect and change the game state, debug drawing on the map.
// Calls are untyped on purpose so it works for any content; type params as JSON.
import {
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { type ReactNode, useEffect, useState } from 'react'
import weatherConfig from '@/content/weather'
import type { FlagValue, WeatherKind } from '../define'
import { recentErrors } from '../errors'
import { game } from '../game'
import { lang } from '../lang'
import { Z } from '../layers/zIndex'
import { type FlagId, flags, useFlag } from '../managers/flags'
import { useItemCount } from '../managers/items'
import { money, useMoney } from '../managers/money'
import { useQuests } from '../managers/quests'
import { relationships, useRelationship } from '../managers/relationships'
import {
  type CharacterId,
  characters,
  type ItemId,
  loadMap,
  type MapId,
  type QuestId,
  registry,
  type TitleId,
} from '../registry'
import { resetPersistent, usePersistentStore } from '../stores/persistent'
import { useSettingsStore } from '../stores/settings'
import { topLayer, useSystemStore } from '../stores/system'
import { peekWorld } from '../world/getWorld'
import { layoutFromTiled, type TiledSource } from '../world/layout'
import { useDevStore } from './store'

type Untyped = (id: string, arg?: unknown) => unknown

const call = (fn: unknown, id: string, arg?: unknown) => {
  Promise.resolve((fn as Untyped)(id, arg)).then(
    (result) => result !== undefined && console.log(`[dev] ${id} ->`, result),
    (error: unknown) => console.error(error),
  )
}

import { LookGallery } from './LookGallery'

export function DevPanel() {
  const open = useSettingsStore((s) => s.showDevPanel)
  const [paramsText, setParamsText] = useState('')
  const [gallery, setGallery] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '`' || e.target instanceof HTMLInputElement) return
      useSettingsStore.setState((s) => {
        s.showDevPanel = !s.showDevPanel
      })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!open) return null

  let params: unknown
  let paramsError = false
  try {
    params = paramsText.trim() ? JSON.parse(paramsText) : undefined
  } catch {
    paramsError = true
  }

  return (
    <>
      {gallery && <LookGallery onClose={() => setGallery(false)} />}
      <Paper
        data-no-screenshot
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: Z.dev,
          p: 2,
          width: 360,
          maxWidth: 'calc(100cqw - 32px)',
          maxHeight: 'calc(100cqh - 32px)',
          overflow: 'auto',
          opacity: 0.95,
        }}
      >
        <Header />
        <Where />
        <TextField
          size="small"
          fullWidth
          label="params (JSON, optional)"
          placeholder='{ "shopId": "anna" }'
          value={paramsText}
          error={paramsError}
          onChange={(e) => setParamsText(e.target.value)}
          sx={{ mt: 1 }}
        />
        <Fold title="Maps & spawns" open>
          <Maps params={params} />
        </Fold>
        <Fold title="Events">
          <Ids ids={registry.events} onClick={(id) => call(game.events.start, id, params)} />
        </Fold>
        <Fold title="Minigames">
          <Ids ids={registry.minigames} onClick={(id) => call(game.minigames.start, id, params)} />
        </Fold>
        <Fold title="Windows">
          <Ids ids={registry.windows} onClick={(id) => call(game.windows.open, id, params)} />
        </Fold>
        <Fold title="Flags">
          {flags.ids.map((id) => (
            <FlagRow key={id} id={id} />
          ))}
        </Fold>
        <Fold title="Relationships">
          {(Object.keys(characters) as CharacterId[]).map((id) => (
            <RelationshipRow key={id} id={id} />
          ))}
        </Fold>
        <Fold title="Money">
          <MoneyRow />
        </Fold>
        <Fold title="Items">
          {registry.items.map((id) => (
            <ItemRow key={id} id={id} />
          ))}
        </Fold>
        <Fold title="Party">
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
            <Button size="small" onClick={() => game.party.giveXp('party', 50, { notify: true })}>
              +50 XP
            </Button>
            <Button size="small" onClick={() => game.party.restore()}>
              restore HP/MP
            </Button>
            <Button
              size="small"
              onClick={() => {
                for (const id of game.party.members()) game.party.change(id, 'hp', -10)
              }}
            >
              −10 HP
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Add to the party:
          </Typography>
          <Ids
            ids={Object.keys(characters)}
            onClick={(id) => game.party.add(id as never, { notify: true })}
          />
        </Fold>
        <Fold title="Battles">
          <Typography variant="caption" color="text.secondary">
            Fight one of:
          </Typography>
          <Ids
            ids={registry.enemies}
            onClick={(id) =>
              void game.battles.start({ enemies: [id as never] }).catch(console.error)
            }
          />
          <Typography variant="caption" color="text.secondary">
            Or a troop (content/troops):
          </Typography>
          <Ids
            ids={registry.troops}
            onClick={(id) => void game.battles.start(id as never).catch(console.error)}
          />
        </Fold>
        <Fold title="Achievements & journal">
          <Typography variant="caption" color="text.secondary">
            Unlock an achievement (kept across saves):
          </Typography>
          <Ids
            ids={registry.achievements}
            onClick={(id) => game.achievements.unlock(id as never)}
          />
          <Typography variant="caption" color="text.secondary">
            Add a journal entry:
          </Typography>
          <Ids ids={registry.codex} onClick={(id) => game.codex.unlock(id as never)} />
        </Fold>
        <Fold title="Quests">
          <QuestRows />
        </Fold>
        <Fold title="Time & weather">
          <TimeWeather />
        </Fold>
        <Fold title="Props">
          <Typography variant="caption" color="text.secondary">
            Spawn in front of the player (saved):
          </Typography>
          <Ids ids={registry.props} onClick={(id) => spawnInFront(id)} />
        </Fold>
        <Fold title="Translations">
          <Translations />
        </Fold>
        <Fold title="Title screens">
          <TitleScreens />
        </Fold>
        <Fold title="Across all saves">
          <Persistent />
        </Fold>
        <Fold title="Look">
          <Button size="small" variant="outlined" onClick={() => setGallery(!gallery)}>
            {gallery ? 'Close look gallery' : 'Open look gallery'}
          </Button>
        </Fold>
        <Fold title="Errors & memory">
          <Health />
        </Fold>
        <Fold title="System state">
          <SystemState />
        </Fold>
        <Typography variant="caption" color="text.secondary">
          Toggle with the ` key
        </Typography>
      </Paper>
    </>
  )
}

/** The last errors (core/errors.ts) and how much decoded sound is held. Refreshes once a second. */
function Health() {
  const [, tick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(timer)
  }, [])
  const errors = recentErrors()
  return (
    <Stack spacing={0.5}>
      <Typography variant="caption" color="text.secondary">
        Sounds in memory: {game.audio.memoryMB().toFixed(1)} MB (budget: content/config/media.ts)
      </Typography>
      {errors.length === 0 ? (
        <Typography variant="caption" color="text.secondary">
          No errors so far.
        </Typography>
      ) : (
        [...errors].reverse().map((error) => (
          <Typography key={`${error.at}-${error.where}-${error.message}`} variant="caption">
            {new Date(error.at).toLocaleTimeString()} [{error.where}] {error.message}
          </Typography>
        ))
      )}
    </Stack>
  )
}

function Header() {
  const state = useSystemStore()
  const showCollision = useDevStore((s) => s.showCollision)
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <Typography variant="h6" sx={{ flex: 1 }}>
        Dev panel
      </Typography>
      <Chip size="small" label={`top: ${topLayer(state)}`} />
      <Chip
        size="small"
        color={showCollision ? 'warning' : 'default'}
        label="collision"
        onClick={() => useDevStore.setState({ showCollision: !showCollision })}
      />
    </Stack>
  )
}

/** Player position on the map (updates a few times per second). */
function Where() {
  const map = useSystemStore((s) => s.map?.id)
  const [info, setInfo] =
    useState<ReturnType<NonNullable<ReturnType<typeof peekWorld>>['debugInfo']>>(null)
  useEffect(() => {
    const timer = setInterval(() => setInfo(peekWorld()?.debugInfo() ?? null), 250)
    return () => clearInterval(timer)
  }, [])
  if (!map || !info) return null
  return (
    <Typography variant="caption" component="div" sx={{ fontFamily: 'monospace' }}>
      {map} · tile {info.tile.x},{info.tile.y} · pos {info.x},{info.y} · {info.facing} ·{' '}
      {info.clock}
    </Typography>
  )
}

function Fold(props: { title: string; open?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(props.open ?? false)
  return (
    <Box sx={{ mt: 1 }}>
      <Typography
        variant="overline"
        component="button"
        onClick={() => setOpen(!open)}
        sx={{
          all: 'unset',
          cursor: 'pointer',
          display: 'block',
          fontSize: 12,
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}
      >
        {open ? '▾' : '▸'} {props.title}
      </Typography>
      {open && <Stack spacing={0.5}>{props.children}</Stack>}
    </Box>
  )
}

function Ids(props: { ids: string[]; onClick: (id: string) => void }) {
  return (
    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
      {props.ids.length === 0 && <Typography color="text.secondary">none</Typography>}
      {props.ids.map((id) => (
        <Button key={id} size="small" variant="outlined" onClick={() => props.onClick(id)}>
          {id}
        </Button>
      ))}
    </Stack>
  )
}

/** Every map with its spawn points: jump straight there. */
function Maps({ params }: { params: unknown }) {
  const [spawns, setSpawns] = useState<Record<string, string[]>>({})
  useEffect(() => {
    let alive = true
    for (const id of registry.maps) {
      loadMap(id)
        .then((def) => {
          const names = Object.keys(layoutFromTiled(def as TiledSource).spawns)
          if (alive) setSpawns((s) => ({ ...s, [id]: names }))
        })
        .catch(() => {})
    }
    return () => {
      alive = false
    }
  }, [])
  const go = (id: MapId, spawn?: string) =>
    call(game.maps.go, id, { ...(params === undefined ? {} : { params }), spawn })
  return (
    <>
      {registry.maps.map((id) => (
        <Stack key={id} direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <Button size="small" variant="contained" onClick={() => go(id)}>
            {id}
          </Button>
          {(spawns[id] ?? []).map((spawn) => (
            <Button key={spawn} size="small" onClick={() => go(id, spawn)}>
              {spawn}
            </Button>
          ))}
        </Stack>
      ))}
    </>
  )
}

function FlagRow({ id }: { id: FlagId }) {
  const value = useFlag(id) as FlagValue
  const set = (v: FlagValue) => flags.set(id, v as never)
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <Typography variant="body2" sx={{ flex: 1, fontFamily: 'monospace' }}>
        {id}
      </Typography>
      {typeof value === 'boolean' && (
        <Switch size="small" checked={value} onChange={(_, checked) => set(checked)} />
      )}
      {typeof value === 'number' && (
        <>
          <IconButton size="small" onClick={() => set(value - 1)}>
            −
          </IconButton>
          <Typography variant="body2">{value}</Typography>
          <IconButton size="small" onClick={() => set(value + 1)}>
            +
          </IconButton>
        </>
      )}
      {typeof value === 'string' && (
        <TextField size="small" value={value} onChange={(e) => set(e.target.value)} />
      )}
      <Button size="small" onClick={() => flags.reset(id)}>
        reset
      </Button>
    </Stack>
  )
}

function RelationshipRow({ id }: { id: CharacterId }) {
  const value = useRelationship(id)
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <Typography variant="body2" sx={{ flex: 1, fontFamily: 'monospace' }}>
        {id}
      </Typography>
      <IconButton size="small" onClick={() => relationships.change(id, -5)}>
        −
      </IconButton>
      <Typography variant="body2">{value}</Typography>
      <IconButton size="small" onClick={() => relationships.change(id, 5)}>
        +
      </IconButton>
    </Stack>
  )
}

function MoneyRow() {
  const value = useMoney()
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <Typography variant="body2" sx={{ flex: 1 }}>
        {money.format(value)}
      </Typography>
      {[-100, -10, 10, 100].map((amount) => (
        <Button key={amount} size="small" onClick={() => money.set(value + amount)}>
          {amount > 0 ? `+${amount}` : amount}
        </Button>
      ))}
    </Stack>
  )
}

function ItemRow({ id }: { id: ItemId }) {
  const count = useItemCount(id)
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <Typography variant="body2" sx={{ flex: 1, fontFamily: 'monospace' }}>
        {id}
      </Typography>
      <IconButton size="small" onClick={() => game.items.remove(id, 1)} disabled={count === 0}>
        −
      </IconButton>
      <Typography variant="body2">{count}</Typography>
      <IconButton size="small" onClick={() => game.items.add(id, 1)}>
        +
      </IconButton>
    </Stack>
  )
}

function QuestRows() {
  const started = useQuests()
  return (
    <>
      {registry.quests.map((id: QuestId) => {
        const entry = started.find((q) => q.id === id)
        return (
          <Stack key={id} direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            <Typography variant="body2" sx={{ flex: 1, fontFamily: 'monospace' }}>
              {id}
              <Typography component="span" variant="caption" color="text.secondary">
                {' '}
                {entry ? `${entry.status}${entry.step ? `: ${entry.step}` : ''}` : 'inactive'}
              </Typography>
            </Typography>
            <Button size="small" onClick={() => game.quests.start(id)}>
              start
            </Button>
            <Button size="small" onClick={() => game.quests.advance(id)}>
              next
            </Button>
            <Button size="small" onClick={() => game.quests.complete(id)}>
              done
            </Button>
            <Button size="small" onClick={() => game.quests.reset(id)}>
              reset
            </Button>
          </Stack>
        )
      })}
    </>
  )
}

function TimeWeather() {
  return (
    <>
      <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
        {[0, 6, 8, 12, 18, 20, 22].map((hour) => (
          <Button key={hour} size="small" onClick={() => game.clock.set(hour)}>
            {String(hour).padStart(2, '0')}:00
          </Button>
        ))}
        <Button size="small" onClick={() => game.clock.advance(60)}>
          +1 h
        </Button>
      </Stack>
      <Stack direction="row" spacing={0.5}>
        {(Object.keys(weatherConfig.kinds) as WeatherKind[]).map((kind) => (
          <Button key={kind} size="small" onClick={() => game.maps.weather(kind)}>
            {kind}
          </Button>
        ))}
        <Button size="small" onClick={() => game.maps.weather(null)}>
          clear
        </Button>
        <Button
          size="small"
          onClick={() => game.maps.lighting('#000000', { strength: 0.6, duration: 500 })}
        >
          dark
        </Button>
        <Button size="small" onClick={() => game.maps.lighting(null, { duration: 500 })}>
          light
        </Button>
      </Stack>
    </>
  )
}

/** Spawns a prop on the tile in front of the player. */
function spawnInFront(prop: string) {
  const info = peekWorld()?.debugInfo()
  if (!info) return
  const step = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[info.facing]
  const at = { x: info.tile.x + (step[0] ?? 0), y: info.tile.y + (step[1] ?? 0) }
  call(game.props.spawn, prop, { at, id: `dev_${prop}_${at.x}_${at.y}` })
}

function Translations() {
  const language = useSettingsStore((s) => s.language)
  const [copied, setCopied] = useState<number | null>(null)
  const copy = () => {
    const lines = lang.missing()
    void navigator.clipboard?.writeText(lines.join('\n'))
    setCopied(lines.length)
  }
  return (
    <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
      {['source', ...lang.ids].map((id) => (
        <Button
          key={id}
          size="small"
          variant={language === id ? 'contained' : 'outlined'}
          onClick={() =>
            useSettingsStore.setState((s) => {
              s.language = id
            })
          }
        >
          {id}
        </Button>
      ))}
      <Button size="small" onClick={copy}>
        copy missing
      </Button>
      {copied !== null && <Typography variant="caption">{copied} copied</Typography>}
    </Stack>
  )
}

/** Title screen variants: unlock, lock, show (kept across saves, like the real unlock). */
function TitleScreens() {
  // Re-render on any unlock or pick.
  usePersistentStore((s) => `${s.titleScreen ?? ''}|${Object.keys(s.unlocked).length}`)
  const current = game.title.current()
  return (
    <Stack spacing={0.5}>
      {registry.titles.map((id: TitleId) => {
        const unlocked = game.title.isUnlocked(id)
        return (
          <Stack key={id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Typography variant="body2" sx={{ flex: 1 }}>
              {id === current ? '▶ ' : ''}
              {id}
            </Typography>
            {unlocked ? (
              <Button size="small" onClick={() => game.title.lock(id)}>
                lock
              </Button>
            ) : (
              <Button size="small" onClick={() => game.title.unlock(id)}>
                unlock
              </Button>
            )}
            <Button size="small" disabled={!unlocked} onClick={() => game.title.select(id)}>
              show
            </Button>
          </Stack>
        )
      })}
    </Stack>
  )
}

/** Read lines, unlocks and achievements (kept across saves). */
function Persistent() {
  const read = usePersistentStore((s) => Object.keys(s.read).length)
  const unlocked = usePersistentStore((s) => Object.keys(s.unlocked).length)
  const achievements = usePersistentStore((s) => Object.keys(s.achievements).length)
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <Typography variant="body2" sx={{ flex: 1 }}>
        {read} read lines · {unlocked} unlocked · {achievements} achievements
      </Typography>
      <Button size="small" color="warning" onClick={resetPersistent}>
        reset
      </Button>
    </Stack>
  )
}

function SystemState() {
  const state = useSystemStore()
  const { minigame, ...rest } = state
  const shown = { ...rest, minigame: minigame && { id: minigame.id, params: minigame.params } }
  return (
    <Box component="pre" sx={{ fontSize: 11, m: 0, whiteSpace: 'pre-wrap' }}>
      {JSON.stringify(shown, null, 2)}
    </Box>
  )
}

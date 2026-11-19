// game.travel: fast travel between known places, and the world map. Places:
// src/content/travel.ts; the window: src/content/windows/travel.
import config from '@/content/travel'
import { t } from '../lang'
import type { MapId } from '../registry'
import { useGameStore } from '../stores/game'
import { topLayer, useSystemStore } from '../stores/system'
import type { TravelPlace } from '../travel'
import { toast } from '../ui/toast'
import { maps } from './maps'
import { money } from './money'
import { windows } from './windows'

export type PlaceId = Extract<keyof typeof config.places, string>

/** Why the player cannot travel right now. */
export type TravelProblem = 'unknown' | 'here' | 'blocked' | 'busy' | 'money'

/** A place as the window shows it. */
export interface PlaceView {
  id: PlaceId
  place: TravelPlace
  /** Already translated. */
  name: string
  description: string
  /** The player is on this place's map. */
  here: boolean
  /** null = the player can go there now. */
  problem: TravelProblem | null
}

const places = config.places as Record<string, TravelPlace>
const found = () => useGameStore.getState().places ?? {}
let started = false

export const travel = {
  /** Whether a place is on the player's list. */
  knows(id: PlaceId): boolean {
    const place = places[id]
    return !!place && ((place.known ?? true) || found()[id] === true)
  },

  /** Adds a place to the list. `notify` shows a toast. Returns false if it was already there. */
  discover(id: PlaceId, options: { notify?: boolean } = {}): boolean {
    if (!places[id]) {
      console.warn(`[travel] unknown place "${id}" (src/content/travel.ts)`)
      return false
    }
    if (travel.knows(id)) return false
    useGameStore.setState((s) => {
      s.places = { ...s.places, [id]: true }
    })
    if (options.notify)
      toast(t('New place: {name}', { name: t((places[id] as TravelPlace).name) }), {
        kind: 'place',
        params: { place: id },
      })
    return true
  },

  forget(id: PlaceId): void {
    useGameStore.setState((s) => {
      const rest = { ...s.places }
      delete rest[id]
      s.places = rest
    })
  },

  /** Why the player cannot go there now, or null when they can. */
  problem(id: PlaceId): TravelProblem | null {
    const place = places[id]
    if (!place || !travel.knows(id)) return 'unknown'
    const system = useSystemStore.getState()
    const current = system.map?.id
    if (current === place.map) return 'here'
    if (current && (config.blockedMaps as readonly string[]).includes(current)) return 'blocked'
    // Only from the map (a window may be open: the travel window itself).
    if (!current || system.event || system.minigame || system.mapTransition !== null) return 'busy'
    if (place.cost && !money.canAfford(place.cost)) return 'money'
    return null
  },

  /**
   * Goes to a known place: pays, closes the windows and changes the map. Resolves null when the
   * player has arrived, or why it did not happen.
   */
  async go(id: PlaceId): Promise<TravelProblem | null> {
    const problem = travel.problem(id)
    if (problem) return problem
    const place = places[id] as TravelPlace
    if (place.cost) money.spend(place.cost)
    windows.closeAll()
    const go = maps.go as (map: MapId, options: object) => Promise<void>
    await go(place.map as MapId, place.spawn ? { spawn: place.spawn } : {})
    return null
  },

  /** Known places in the order of the file. */
  list(): PlaceView[] {
    const current = useSystemStore.getState().map?.id
    return (Object.keys(places) as PlaceId[]).filter(travel.knows).map((id) => {
      const place = places[id] as TravelPlace
      return {
        id,
        place,
        name: t(place.name),
        description: place.description ? t(place.description) : '',
        here: place.map === current,
        problem: travel.problem(id),
      }
    })
  },

  /** Whether the pause menu should offer "Travel". */
  inMenu(): boolean {
    return config.inMenu && travel.list().length >= 2
  },

  /** Opens the travel window (the world map). */
  open(): void {
    ;(windows.open as (id: string) => void)('travel')
  },

  /** Starts adding places as the player reaches their maps. Called once from boot.tsx. */
  start(): void {
    if (started) return
    started = true
    maps.onChange((map) => {
      if (!config.discoverOnVisit) return
      // Quiet while a save loads or on the title screen's map; a toast only in play.
      const playing = topLayer(useSystemStore.getState()) !== 'title'
      for (const [id, place] of Object.entries(places))
        if (place.map === map) travel.discover(id as PlaceId, { notify: playing })
    })
  },
}

/** React: the known places, re-drawn when the list, the map or the money changes. */
export function usePlaces(): PlaceView[] {
  useGameStore((s) => s.places)
  useGameStore((s) => s.money)
  useSystemStore((s) => s.map?.id)
  return travel.list()
}

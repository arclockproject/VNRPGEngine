// Dev-only switches (not saved): debug drawing on the map.
import { create } from 'zustand'

interface DevState {
  /** Draw collision, interaction and trigger areas, object ids and the player's hitbox. */
  showCollision: boolean
}

export const useDevStore = create<DevState>(() => ({ showCollision: false }))

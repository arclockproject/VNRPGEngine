// The game's own data kept across ALL saves and new games on this device, next to the engine's
// (read lines, gallery, achievements…): "cleared once", how many endings were seen, a secret
// unlocked from the title screen. Per-save data goes in data.ts instead. Edit freely.
//   game.persistent.get('clearedOnce') / game.persistent.set('clearedOnce', true);
//   in React usePersistent('clearedOnce') (from '@/core/managers/persistentGame').
// A value added later starts at its value here (no migration needed). Renaming or changing the
// kind of one: a step in persistent_migrations/ (the data is under `game` there). It goes into
// backups, and "Erase all data" clears it.
import { definePersistent } from '@/core/persistentGame'

export default definePersistent({
  // clearedOnce: false,
  // endingsSeen: 0,
})

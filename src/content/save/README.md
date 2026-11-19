# Save content

- `data.ts`: the shape of your saved game data (`initialData`).
- `index.ts`: new game, load hooks, autosave.
- `migrations/vN.ts`: upgrades old **save files**. None yet: saves are version 1.
- `persistent_migrations/vN.ts`: upgrades old **persistent data** (read lines, unlocks,
  achievements). None yet: version 1.

Both migration folders work the same way. Create the folder when you add the first file.
The first file is `v2.ts` (upgrades version 1 to 2), then `v3.ts`, and so on, with no gaps.
Each time, add an example of the old data to `OLD_SAVES` / `OLD_PERSISTENT` in `../save.test.ts`.

Full guide with examples: docs/systems/saves.html, "Versions and migrations".

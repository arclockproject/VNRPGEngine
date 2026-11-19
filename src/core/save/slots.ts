// How many save boxes fit in a browser's storage. Desktop and Android store files: no limit there.

/** Sizes in characters (what localStorage counts). Set in src/content/save/index.ts. */
export interface BrowserStorage {
  /** What a browser gives one site. The smallest common one (Safari) is about 2.6 million. */
  storage: number
  /** Kept free for everything that isn't a save slot: settings, read lines, unlocks, achievements. */
  reserved: number
  /** Room for one save: its picture plus its data. Raise it as the game's save data grows. */
  perSave: number
}

/** Boxes that are not manual slots: autosave, quick save. */
export const SPECIAL_BOXES = 2

/** Save boxes (the special ones included) that fit, at least one manual slot. */
export function browserBoxes(browser: BrowserStorage): number {
  const fits = Math.floor((browser.storage - browser.reserved) / Math.max(1, browser.perSave))
  return Math.max(SPECIAL_BOXES + 1, fits)
}

/** Manual slots to offer: all of them with files, as many as fit in a browser. */
export function manualSlotCount(
  slots: number,
  browser: BrowserStorage | undefined,
  files: boolean,
) {
  const wanted = Math.max(1, Math.floor(slots))
  return files || !browser ? wanted : Math.min(wanted, browserBoxes(browser) - SPECIAL_BOXES)
}

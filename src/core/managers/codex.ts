// game.codex: the journal (people, places, lore), found per playthrough and saved with the game.
import type { CodexConfig } from '../define'
import { getGame } from '../gameRef'
import { t } from '../lang'
import { type CodexId, codex as defs, registry } from '../registry'
import { useGameStore } from '../stores/game'
import { unlockable } from '../unlocks'

const def = (id: CodexId) => (defs as Record<string, CodexConfig>)[id] as CodexConfig
const found = () => useGameStore.getState().codex

/** What the journal shows for an entry right now. */
export interface CodexPage {
  title: string
  category: string
  text: string
  image?: string
}

export interface CodexEntry {
  id: CodexId
  /** The entry as it reads now (its matching version applied). */
  entry: CodexPage
  /** Index in `versions` of the version shown, or null for the entry's own text. */
  version: number | null
  /** Whether the player has found it (only found entries are shown). */
  found: boolean
}

/** Index of the first version whose `when` is true. A failing `when` counts as false. */
function pickVersion(id: CodexId): number | null {
  const versions = def(id)?.versions
  if (!versions?.length) return null
  const game = getGame()
  for (let i = 0; i < versions.length; i++) {
    try {
      if (versions[i]?.when(game)) return i
    } catch (error) {
      console.warn(`[codex] versions[${i}].when of "${id}" failed`, error)
    }
  }
  return null
}

function resolve(id: CodexId): Pick<CodexEntry, 'entry' | 'version'> {
  const base = def(id)
  const version = pickVersion(id)
  const v = version === null ? undefined : base.versions?.[version]
  return {
    version,
    entry: {
      title: v?.title ?? base.title,
      category: base.category,
      text: v?.text ?? base.text,
      image: v?.image ?? base.image,
    },
  }
}

const unlocks = unlockable<CodexId>({
  name: 'journal entry',
  exists: (id) => id in defs,
  perSave: true,
  store: {
    has: (id) => id in found(),
    add: (id) =>
      useGameStore.setState((s) => {
        s.codex[id] = new Date().toISOString()
      }),
    remove: (id) =>
      useGameStore.setState((s) => {
        delete s.codex[id]
      }),
  },
  toast: (id) => ({
    text: t('New journal entry: {title}', { title: t(resolve(id).entry.title) }),
    kind: 'codex',
    params: { entry: id },
  }),
})

export const codex = {
  /** Adds the entry to the journal. Shows "New journal entry" unless `notify: false`. */
  unlock: unlocks.unlock,

  has: unlocks.has,

  /** One entry as it reads now (found or not). */
  get(id: CodexId): CodexEntry {
    return { id, ...resolve(id), found: codex.has(id) }
  },

  list(): CodexEntry[] {
    return registry.codex.map((id) => codex.get(id))
  },

  /** Found entries grouped by category (in folder order). */
  byCategory(): { category: string; entries: CodexEntry[] }[] {
    const groups = new Map<string, CodexEntry[]>()
    for (const e of codex.list()) {
      if (!e.found) continue
      const list = groups.get(e.entry.category) ?? []
      list.push(e)
      groups.set(e.entry.category, list)
    }
    return [...groups].map(([category, entries]) => ({ category, entries }))
  },
}

/** Found entries and the version each shows, as one string (changes when the journal should). */
const signature = () =>
  codex
    .list()
    .filter((e) => e.found)
    .map((e) => `${e.id}:${e.version ?? '-'}`)
    .join(',')

/** React: re-renders when an entry is found or switches version. */
export function useCodex(): ReturnType<typeof codex.byCategory> {
  useGameStore(signature)
  return codex.byCategory()
}

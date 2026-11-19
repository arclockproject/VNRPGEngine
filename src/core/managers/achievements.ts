// game.achievements: unlocked once, kept across all saves and new games (per device).
import type { AchievementConfig } from '../define'
import { t } from '../lang'
import { type AchievementId, achievements as defs, registry } from '../registry'
import { usePersistentStore } from '../stores/persistent'
import { unlockable } from '../unlocks'

const def = (id: AchievementId) => (defs as Record<string, AchievementConfig | undefined>)[id]

export interface AchievementEntry {
  id: AchievementId
  achievement: AchievementConfig
  /** ISO date it was earned, or null. */
  unlockedAt: string | null
}

const earned = () => usePersistentStore.getState().achievements

const unlocks = unlockable<AchievementId>({
  name: 'achievement',
  exists: (id) => def(id) !== undefined,
  store: {
    has: (id) => id in earned(),
    add: (id) =>
      usePersistentStore.setState((s) => {
        s.achievements[id] = new Date().toISOString()
      }),
    remove: (id) =>
      usePersistentStore.setState((s) => {
        delete s.achievements[id]
      }),
  },
  toast: (id) => {
    const achievement = def(id) as AchievementConfig
    return {
      text: t('Achievement: {title}', { title: t(achievement.title) }),
      kind: 'achievement',
      params: { achievement: id },
      ...(achievement.icon ? { icon: achievement.icon } : {}),
    }
  },
})

export const achievements = {
  /** Earns it (once) and shows a toast. Returns false if it was already earned. */
  unlock: unlocks.unlock,

  has: unlocks.has,

  /** Every achievement in folder order, earned or not. */
  list(): AchievementEntry[] {
    return registry.achievements.map((id) => ({
      id,
      achievement: def(id) as AchievementConfig,
      unlockedAt: earned()[id] ?? null,
    }))
  },

  /** Forget one (dev panel). */
  reset: unlocks.lock,
}

/** React: re-renders when an achievement is earned. */
export function useAchievements(): AchievementEntry[] {
  usePersistentStore((s) => s.achievements)
  return achievements.list()
}

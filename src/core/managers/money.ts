// game.money: the player's money (saved). Currency settings: src/content/config/money.ts.
import moneyConfig from '@/content/config/money'
import { t } from '../lang'
import { useGameStore } from '../stores/game'
import { toast } from '../ui/toast'

export const startMoney = () => moneyConfig.start ?? 0
const clamp = (value: number) =>
  Math.max(0, Math.min(moneyConfig.max ?? Number.POSITIVE_INFINITY, Math.floor(value)))

export const money = {
  get(): number {
    return useGameStore.getState().money
  },

  set(value: number): void {
    useGameStore.setState((s) => {
      s.money = clamp(value)
    })
  },

  /** Adds money (up to the max). Returns how much was really added. `notify` shows a toast. */
  add(amount: number, options: { notify?: boolean } = {}): number {
    const before = money.get()
    money.set(before + Math.max(0, amount))
    const added = money.get() - before
    if (options.notify && added > 0) {
      toast(`+${money.format(added)}`, {
        icon: moneyConfig.icon,
        kind: 'money',
        params: { amount: added },
      })
    }
    return added
  },

  /** Takes money away. Not enough = nothing is taken and it returns false. */
  spend(amount: number): boolean {
    if (!money.canAfford(amount)) return false
    money.set(money.get() - amount)
    return true
  },

  /** Most the player can carry (Infinity = no limit). */
  max(): number {
    return moneyConfig.max ?? Number.POSITIVE_INFINITY
  },

  canAfford(amount: number): boolean {
    return money.get() >= amount
  },

  /** '{amount} coins' from src/content/config/money.ts, translated. */
  format(amount: number): string {
    return t(moneyConfig.format, { amount })
  },
}

/** React: the player's money. */
export function useMoney(): number {
  return useGameStore((s) => s.money)
}

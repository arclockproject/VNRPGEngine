// LB / RB (keys Q / R) switch tabs in a window: `useTabs(setTab, ['gallery', 'scenes'])`.
import type { Dispatch, SetStateAction } from 'react'
import { useAction } from './useAction'

export function useTabs<T extends string>(
  setTab: Dispatch<SetStateAction<T>>,
  order: readonly T[],
) {
  const step = (by: number) =>
    setTab((current) => {
      const index = order.indexOf(current)
      return order[(index + by + order.length) % order.length] as T
    })
  useAction('tabNext', () => step(1), { layers: ['windows'] })
  useAction('tabPrev', () => step(-1), { layers: ['windows'] })
}

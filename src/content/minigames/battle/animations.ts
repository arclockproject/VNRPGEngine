import { keyframes } from '@emotion/react'

/** A short reaction a fighter plays: its sprite's tag if it has one, else a CSS move. */
export type Reaction = { state: 'hurt' | 'attack'; n: number }

/** A number or word that floats up over a fighter (damage, Miss, Weak!…). */
export type Popup = {
  id: number
  /** Fighter key. */
  key: string
  text: string
  tone: 'damage' | 'heal' | 'mp' | 'crit' | 'weak' | 'muted'
}

/** How long a popup stays (ms). */
export const POPUP_MS = 1100

export const hurt = keyframes`0%, 100% { transform: none } 25% { transform: translateX(-6px) } 75% { transform: translateX(6px) }`
export const lungeRight = keyframes`0%, 100% { transform: none } 40% { transform: translateX(24px) }`
export const lungeLeft = keyframes`0%, 100% { transform: none } 40% { transform: translateX(-24px) }`
export const floatUp = keyframes`0% { transform: translateY(8px) scale(0.6); opacity: 0 } 15% { transform: translateY(0) scale(1.15); opacity: 1 } 30% { transform: translateY(-4px) scale(1) } 80% { opacity: 1 } 100% { transform: translateY(-28px); opacity: 0 }`

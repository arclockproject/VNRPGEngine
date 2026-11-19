import type { Direction } from './define'

export interface Rect {
  left: number
  top: number
  width: number
  height: number
}

/**
 * Picks the candidate that is best reached by moving `direction` from `from`.
 * Score = gap between the two boxes in that direction, plus how far they are apart across it.
 * A wide slider that overlaps the current item across counts as "in line" even if its knob
 * (or centre) is far to the side, so it doesn't lose to the item directly below.
 * Items that line up with `from` win over ones that don't. Returns -1 if none.
 */
export function pickInDirection(from: Rect, candidates: Rect[], direction: Direction): number {
  const vertical = direction === 'up' || direction === 'down'
  const pick = (aligned: boolean) => {
    let best = -1
    let bestScore = Number.POSITIVE_INFINITY
    candidates.forEach((rect, index) => {
      const dy = rect.top + rect.height / 2 - (from.top + from.height / 2)
      const dx = rect.left + rect.width / 2 - (from.left + from.width / 2)
      const ahead =
        direction === 'down' ? dy : direction === 'up' ? -dy : direction === 'right' ? dx : -dx
      if (ahead <= 1) return
      const across = gapAcross(from, rect, vertical)
      if (aligned && across > 0) return
      const gap = gapAhead(from, rect, direction)
      const score = gap + across * 2
      if (score < bestScore) {
        bestScore = score
        best = index
      }
    })
    return best
  }
  const aligned = pick(true)
  return aligned !== -1 ? aligned : pick(false)
}

/** Space between the two boxes in the direction of movement (0 when touching or overlapping). */
function gapAhead(from: Rect, to: Rect, direction: Direction): number {
  const gap =
    direction === 'down'
      ? to.top - (from.top + from.height)
      : direction === 'up'
        ? from.top - (to.top + to.height)
        : direction === 'right'
          ? to.left - (from.left + from.width)
          : from.left - (to.left + to.width)
  return Math.max(0, gap)
}

/** Distance between the two boxes across the movement (0 when their spans overlap). */
function gapAcross(a: Rect, b: Rect, vertical: boolean): number {
  const [aStart, aEnd, bStart, bEnd] = vertical
    ? [a.left, a.left + a.width, b.left, b.left + b.width]
    : [a.top, a.top + a.height, b.top, b.top + b.height]
  return Math.max(0, Math.max(aStart, bStart) - Math.min(aEnd, bEnd))
}

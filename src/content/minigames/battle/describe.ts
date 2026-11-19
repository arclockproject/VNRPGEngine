import type { Battle, LogEntry } from '@/core/battle/engine'
import type { useLang } from '@/core/lang'

/** One battle log entry as a line of text for the player ('' = nothing to say). */
export function describe(t: ReturnType<typeof useLang>, battle: Battle, e: LogEntry): string {
  const status = (id: string | undefined) => t(battle.statusInfo(id ?? '')?.name ?? id ?? '')
  switch (e.kind) {
    case 'use':
      return e.via
        ? t('{actor} uses {via}!', { actor: e.actor, via: t(e.via) })
        : t('{actor} attacks!', { actor: e.actor })
    case 'passive':
      return t('{via}:', { via: e.via })
    case 'damage': {
      const v = { target: e.target, amount: e.amount }
      const parts = [
        e.rate === 'immune' ? t('{target} is immune.', v) : t('{target} takes {amount} damage.', v),
      ]
      if (e.crit) parts.push(t('A critical hit!'))
      if (e.rate === 'weak') parts.push(t("It's a weak spot!"))
      if (e.rate === 'resist') parts.push(t('It resists.'))
      if (e.down) parts.push(t('{target} falls.', v))
      return parts.join(' ')
    }
    case 'miss':
      return t('Missed {target}!', { target: e.target })
    case 'heal':
      return e.pool === 'mp'
        ? t('{target} recovers {amount} MP.', { target: e.target, amount: e.amount })
        : t('{target} recovers {amount} HP.', { target: e.target, amount: e.amount })
    case 'status':
      return e.resisted
        ? t('{target} resists {status}.', { target: e.target, status: status(e.status) })
        : t('{target}: {status}.', { target: e.target, status: status(e.status) })
    case 'statusEnd':
      return t('{target}: {status} wears off.', { target: e.target, status: status(e.status) })
    case 'tick': {
      const v = { target: e.target, amount: Math.abs(e.amount), status: status(e.status) }
      const line =
        e.amount < 0
          ? t('{status}: {target} loses {amount}.', v)
          : t('{status}: {target} recovers {amount}.', v)
      return e.down ? `${line} ${t('{target} falls.', v)}` : line
    }
    case 'revive':
      return t('{target} is back up!', { target: e.target })
    case 'delay':
      return e.amount > 0
        ? t('{target} is held back.', { target: e.target })
        : t('{target} will act sooner.', { target: e.target })
    case 'skip':
      return e.status
        ? t("{actor} can't move ({status}).", { actor: e.actor, status: status(e.status) })
        : t('{actor} waits.', { actor: e.actor })
    case 'defend':
      return t('{actor} defends.', { actor: e.actor })
    case 'flee':
      return e.success ? t('{actor} got away!', { actor: e.actor }) : t("Couldn't escape!")
    case 'fail':
      return e.reason === 'mp'
        ? t('Not enough MP!')
        : e.reason === 'skills'
          ? t("{actor} can't use skills right now.", { actor: e.actor })
          : t("That didn't work.")
  }
}

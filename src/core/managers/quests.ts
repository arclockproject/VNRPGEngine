// game.quests: quests with ordered steps (src/content/quests/<id>). Progress is saved.
import type { QuestDefinition, QuestStep } from '../define'
import { getGame } from '../gameRef'
import { t, tx } from '../lang'
import { type QuestId, type QuestStepOf, quests as questRegistry, registry } from '../registry'
import { type QuestState, type QuestStatus, useGameStore } from '../stores/game'
import { toast } from '../ui/toast'

export type QuestProgress = QuestStatus | 'inactive'

const questDefs = questRegistry as Record<string, QuestDefinition>

/** One line of the quest log. */
export interface QuestStepView {
  id: string
  /** What to show: the step's text, or its hiddenText while masked. Not translated yet. */
  text: string
  /** Its `when` is still false: `text` is the placeholder. */
  masked: boolean
  done: boolean
  current: boolean
}

export interface QuestEntry {
  id: QuestId
  quest: QuestDefinition
  status: QuestStatus
  step: string | null
  /** Steps finished so far (all of them once done). */
  doneSteps: string[]
  /**
   * The lines to show, in order: finished steps, the current one, and steps with a `when` (those
   * are listed from the start, masked until it is true). Other later steps are left out.
   */
  steps: QuestStepView[]
}

const asStep = (step: string | QuestStep): QuestStep =>
  typeof step === 'string' ? { text: step } : step

function stepViews(id: QuestId, current: string | null, done: string[]): QuestStepView[] {
  const views: QuestStepView[] = []
  for (const [stepId, raw] of Object.entries(questDefs[id]?.steps ?? {})) {
    const step = asStep(raw)
    const isDone = done.includes(stepId)
    const isCurrent = stepId === current
    if (!isDone && !isCurrent && !step.when) continue
    let revealed = true
    if (step.when && !isDone) {
      try {
        revealed = !!step.when({ game: getGame() })
      } catch (error) {
        console.error(`[quests] "when" of / failed`, error)
        revealed = false
      }
    }
    views.push({
      id: stepId,
      text: revealed ? step.text : (step.hiddenText ?? tx('???')),
      masked: !revealed,
      done: isDone,
      current: isCurrent,
    })
  }
  return views
}

function stepIds(id: QuestId): string[] {
  return Object.keys(questDefs[id]?.steps ?? {})
}

function setState(id: QuestId, state: QuestState) {
  useGameStore.setState((s) => {
    s.quests[id] = state
  })
}

function entry(id: QuestId, state: QuestState): QuestEntry {
  const steps = stepIds(id)
  const index = state.step ? steps.indexOf(state.step) : steps.length
  const doneSteps = state.status === 'done' ? steps : steps.slice(0, Math.max(0, index))
  return {
    id,
    quest: questDefs[id] as QuestDefinition,
    status: state.status,
    step: state.step,
    doneSteps,
    steps: stepViews(id, state.step, doneSteps),
  }
}

function run(hook: ((ctx: { game: ReturnType<typeof getGame> }) => void) | undefined) {
  if (!hook) return
  Promise.resolve(hook({ game: getGame() })).catch((error: unknown) =>
    console.error('[quests]', error),
  )
}

export const quests = {
  status(id: QuestId): QuestProgress {
    return useGameStore.getState().quests[id]?.status ?? 'inactive'
  },

  /** The current step (null when not active). */
  step<K extends QuestId>(id: K): QuestStepOf<K> | null {
    const state = useGameStore.getState().quests[id]
    return (state?.status === 'active' ? state.step : null) as QuestStepOf<K> | null
  },

  isActive(id: QuestId): boolean {
    return quests.status(id) === 'active'
  },

  isDone(id: QuestId): boolean {
    return quests.status(id) === 'done'
  },

  /** Whether `step` is finished (steps before the current one, or every step once done). */
  isStepDone<K extends QuestId>(id: K, step: QuestStepOf<K>): boolean {
    const state = useGameStore.getState().quests[id]
    return !!state && entry(id, state).doneSteps.includes(step as string)
  },

  /** Starts a quest (at its first step, or `step`). Does nothing if it is already active or done. */
  start<K extends QuestId>(id: K, step?: QuestStepOf<K>): void {
    if (quests.status(id) === 'active' || quests.status(id) === 'done') return
    const first = (step as string | undefined) ?? stepIds(id)[0] ?? null
    setState(id, { status: 'active', step: first })
    toast(t('New quest: {title}', { title: t(questDefs[id]?.title ?? id) }), {
      kind: 'questNew',
      params: { quest: id },
    })
    run(questDefs[id]?.onStart)
  },

  /** Moves to `step` (starting the quest if needed). */
  setStep<K extends QuestId>(id: K, step: QuestStepOf<K>): void {
    if (quests.status(id) !== 'active') quests.start(id, step)
    else setState(id, { status: 'active', step: step as string })
  },

  /** Next step, or completes the quest after the last one. */
  advance(id: QuestId): void {
    const state = useGameStore.getState().quests[id]
    if (state?.status !== 'active') return
    const steps = stepIds(id)
    const next = steps[steps.indexOf(state.step ?? '') + 1]
    if (next) setState(id, { status: 'active', step: next })
    else quests.complete(id)
  },

  complete(id: QuestId): void {
    if (quests.status(id) === 'done') return
    setState(id, { status: 'done', step: null })
    toast(t('Quest complete: {title}', { title: t(questDefs[id]?.title ?? id) }), {
      kind: 'questDone',
      params: { quest: id },
    })
    run(questDefs[id]?.onComplete)
  },

  fail(id: QuestId): void {
    setState(id, { status: 'failed', step: null })
  },

  /** Forgets all progress (back to never started). */
  reset(id: QuestId): void {
    useGameStore.setState((s) => {
      delete s.quests[id]
    })
  },

  /** Started quests: active first, then done/failed (in content order). */
  list(): QuestEntry[] {
    return listFrom(useGameStore.getState().quests)
  },
}

function listFrom(states: Record<string, QuestState>): QuestEntry[] {
  const order: Record<QuestStatus, number> = { active: 0, done: 1, failed: 2 }
  return registry.quests
    .filter((id) => states[id])
    .map((id) => entry(id, states[id] as QuestState))
    .sort((a, b) => order[a.status] - order[b.status])
}

/**
 * React: started quests. Re-renders when progress changes, and when a masked step's `when` flips
 * (flags, items… live in the same store, so the lines are compared on every change).
 */
export function useQuests(): QuestEntry[] {
  useGameStore((s) =>
    listFrom(s.quests)
      .map((q) => [q.id, q.status, q.step, ...q.steps.map((v) => v.text)].join('|'))
      .join('\n'),
  )
  return listFrom(useGameStore.getState().quests)
}

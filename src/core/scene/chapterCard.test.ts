// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { useSystemStore } from '../stores/system'

vi.mock('../registry', () => ({
  audioFiles: {},
  movies: {},
  backgrounds: {},
  characters: { kim: { name: 'Kim' } },
}))

const { advance, pick, resetScene, sceneApi } = await import('./director')
const {
  chapterCardCovered,
  chapterCardCovering,
  chapterCardLeaving,
  endChapterCard,
  isUnderCard,
  showChapterCard,
  useChapterCard,
} = await import('./chapterCard')
const api = sceneApi as unknown as {
  say: (who: string, text: string) => Promise<void>
  choice: (options: string[]) => Promise<unknown>
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
const scene = () => useSystemStore.getState().scene
const card = { label: 'Chapter 2', title: 'Summer', ms: 2000, fadeMs: 400, skippable: true }

describe('the chapter card', () => {
  it('the next line and choice wait until it is gone', async () => {
    resetScene()
    showChapterCard(card)
    expect(useChapterCard.getState().card).toMatchObject({ label: 'Chapter 2', title: 'Summer' })
    const said = api.say('kim', 'Hello')
    await flush()
    expect(scene().line).toBeNull()
    endChapterCard()
    await flush()
    expect(scene().line?.text).toBe('Hello')
    advance()
    await said
    showChapterCard(card)
    const picked = api.choice(['A', 'B'])
    await flush()
    expect(scene().choices).toBeNull()
    endChapterCard()
    await flush()
    expect(scene().choices?.map((c) => c.label)).toEqual(['A', 'B'])
    pick(1)
    expect(await picked).toBe(1)
  })

  it('a scene that ends while it waits never goes on (a load, back to the title)', async () => {
    resetScene()
    showChapterCard(card)
    void api.say('kim', 'Too late')
    await flush()
    resetScene()
    endChapterCard()
    await flush()
    expect(scene().line).toBeNull()
  })
})

describe('screen and overlay cards', () => {
  const stage = sceneApi as unknown as {
    background: (value: string | null, options?: { duration?: number }) => void
  }

  it('the old timing (ms + fadeMs) still works; steps win', () => {
    showChapterCard(card)
    expect(useChapterCard.getState().card).toMatchObject({
      style: 'screen',
      fadeIn: 400,
      fadeOut: 400,
      steps: [1200],
    })
    showChapterCard({ ...card, steps: [800, 1500], fadeIn: 100 })
    expect(useChapterCard.getState().card).toMatchObject({ steps: [800, 1500], fadeIn: 100 })
    endChapterCard()
  })

  it('a screen card: wait until it covers; stage changes under it are instant', async () => {
    resetScene()
    showChapterCard(card)
    const covered = chapterCardCovered()
    expect(covered).not.toBeNull()
    expect(isUnderCard()).toBe(false)
    let done = false
    void covered?.then(() => {
      done = true
    })
    await flush()
    expect(done).toBe(false)
    chapterCardCovering()
    await flush()
    expect(done).toBe(true)
    expect(isUnderCard()).toBe(true)
    expect(chapterCardCovered()).toBeNull()
    stage.background('/new.png', { duration: 800 })
    expect(scene().backgroundFade).toBe(0)
    chapterCardLeaving()
    expect(isUnderCard()).toBe(false)
    endChapterCard()
  })

  it('an overlay card never holds the stage', () => {
    showChapterCard({ ...card, style: 'overlay' })
    expect(chapterCardCovered()).toBeNull()
    chapterCardCovering()
    expect(isUnderCard()).toBe(false)
    endChapterCard()
  })

  it('ending a card early lets a waiting chapter() go on', async () => {
    showChapterCard(card)
    const covered = chapterCardCovered()
    endChapterCard()
    await expect(covered).resolves.toBeUndefined()
  })
})

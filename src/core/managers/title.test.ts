// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import inputConfig from '@/content/config/input'
import { input } from '../input/manager'
import { useSystemStore } from '../stores/system'
import { pickTitleMenu, title, titleMenuEntered } from './title'

// Title screen variants load instantly here; `loaded` lets a test hold the loading back.
let loaded: Promise<void> = Promise.resolve()
vi.mock('../titles', async (original) => ({
  ...(await original<typeof import('../titles')>()),
  currentTitle: () => 'default',
  prepareTitle: () => loaded.then(() => () => null),
  warmTitles: async () => {},
  releaseTitles: () => {},
}))

// Two boot screens: the first cannot be skipped, the second can.
const bootScreens = [
  { skippable: false, fadeIn: 100, steps: 1000, fadeOut: 100, screen: () => null },
  { skippable: true, fadeIn: 100, steps: [500, 500], fadeOut: 400, screen: () => null },
]
vi.mock('../boot', async (original) => ({
  ...(await original<typeof import('../boot')>()),
  loadBootScreens: async () => bootScreens,
}))

/** The entrance of titles/default (its `intro`). */
const INTRO_MS = 1200
const initial = useSystemStore.getState()
const confirmKey = inputConfig.actions.confirm.keys?.[0] ?? 'Enter'
const press = (code: string) => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, cancelable: true }))
  window.dispatchEvent(new KeyboardEvent('keyup', { code }))
}

beforeEach(() => {
  loaded = Promise.resolve()
  vi.useFakeTimers({ toFake: ['setTimeout', 'performance'] })
  useSystemStore.setState(initial, true)
  input.start()
})
afterEach(() => {
  input.stop()
  vi.useRealTimers()
})

it('waits for any key, ignores early presses, and does not leak the key to the map', async () => {
  const onMapConfirm = vi.fn()
  input.on('confirm', onMapConfirm, { layers: ['map'] })
  let done = false
  void title.show().then(() => {
    done = true
  })
  expect(useSystemStore.getState().title).toBe('waiting')
  await vi.waitFor(() => expect(useSystemStore.getState().titleReady).toBe(true))

  press('KeyQ') // too early: still held from before
  await Promise.resolve()
  expect(done).toBe(false)

  vi.advanceTimersByTime(500)
  press(confirmKey) // any key, here one that is also bound on the map
  await Promise.resolve()
  expect(done).toBe(false) // the entrance plays first
  expect(useSystemStore.getState().title).toBe('intro')
  await vi.advanceTimersByTimeAsync(INTRO_MS)
  expect(done).toBe(true)
  expect(useSystemStore.getState().title).toBe('shown') // still visible
  expect(useSystemStore.getState().titleMenuIn).toBe(false) // the menu still has to appear
  expect(onMapConfirm).not.toHaveBeenCalled()

  const hidden = title.hide()
  await vi.advanceTimersByTimeAsync(title.fadeMs)
  await hidden
  expect(useSystemStore.getState().title).toBeNull()
})

it('menu resolves with the picked key, or null when the title is hidden', async () => {
  void title.show()
  const first = title.menu({ continue: 'Continue', new: 'New game' })
  expect(useSystemStore.getState().titleMenu).toEqual(['Continue', 'New game'])
  let picked: string | null | undefined
  void first.then((key) => {
    picked = key
  })
  pickTitleMenu(0) // the buttons are still appearing: nothing can be picked
  await Promise.resolve()
  expect(picked).toBeUndefined()
  titleMenuEntered()
  pickTitleMenu(1)
  expect(await first).toBe('new')

  const second = title.menu({ a: 'A' })
  const hidden = title.hide()
  expect(await second).toBeNull()
  expect(useSystemStore.getState().title).toBe('leaving')
  await vi.advanceTimersByTimeAsync(title.fadeMs)
  await hidden
  expect(useSystemStore.getState().title).toBeNull()
})

it('closes windows left open when the title screen comes back, so input is not stuck', async () => {
  useSystemStore.setState((s) => {
    s.windows.push({ id: 'inventory', params: undefined })
  })
  let done = false
  void title.show().then(() => {
    done = true
  })
  expect(useSystemStore.getState().windows).toEqual([])
  await vi.waitFor(() => expect(useSystemStore.getState().titleReady).toBe(true))
  vi.advanceTimersByTime(500)
  press('KeyF')
  await vi.advanceTimersByTimeAsync(INTRO_MS)
  expect(done).toBe(true)
})

it('takes the input but ignores keys until the title screen has loaded', async () => {
  let finish = () => {}
  loaded = new Promise((resolve) => {
    finish = resolve
  })
  let done = false
  void title.show().then(() => {
    done = true
  })
  expect(useSystemStore.getState().title).toBe('waiting') // the title owns input while loading
  expect(useSystemStore.getState().titleReady).toBe(false)
  vi.advanceTimersByTime(2000)
  press('KeyF')
  await Promise.resolve()
  expect(done).toBe(false) // nothing to see yet: not skipped

  finish()
  await vi.waitFor(() => expect(useSystemStore.getState().titleReady).toBe(true))
  vi.advanceTimersByTime(500)
  press('KeyF')
  await vi.advanceTimersByTimeAsync(INTRO_MS)
  expect(done).toBe(true)
})

it('confirm skips the entrance: the art and the menu are in their final look at once', async () => {
  let done = false
  void title.show().then(() => {
    done = true
  })
  await vi.waitFor(() => expect(useSystemStore.getState().titleReady).toBe(true))
  vi.advanceTimersByTime(500)
  press('KeyQ')
  expect(useSystemStore.getState().title).toBe('intro')

  press('KeyQ') // not a confirm key: the entrance keeps playing
  expect(useSystemStore.getState().title).toBe('intro')
  press(confirmKey)
  await Promise.resolve()
  expect(done).toBe(true)
  const state = useSystemStore.getState()
  expect(state.title).toBe('shown')
  expect(state.titleMenuIn).toBe(true)
  expect(state.titleSkips).toBe(1)
})

it('confirm while the menu appears shows it in full, and does not pick anything', async () => {
  void title.show()
  await vi.waitFor(() => expect(useSystemStore.getState().titleReady).toBe(true))
  vi.advanceTimersByTime(500)
  press('KeyQ')
  await vi.advanceTimersByTimeAsync(INTRO_MS)
  let picked: string | null | undefined
  void title.menu({ new: 'New game' }).then((key) => {
    picked = key
  })
  expect(useSystemStore.getState().titleMenuIn).toBe(false)
  press(confirmKey)
  await Promise.resolve()
  expect(useSystemStore.getState().titleMenuIn).toBe(true)
  expect(useSystemStore.getState().titleSkips).toBe(0) // the art had finished by itself
  expect(picked).toBeUndefined()
})

it('one click leaves "press any key" without also skipping the entrance; the next one skips', async () => {
  const click = () => window.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
  void title.show()
  await vi.waitFor(() => expect(useSystemStore.getState().titleReady).toBe(true))
  vi.advanceTimersByTime(500)
  click()
  expect(useSystemStore.getState().title).toBe('intro')
  click()
  expect(useSystemStore.getState()).toMatchObject({ title: 'shown', titleMenuIn: true })
})

// One test: boot() only ever plays once per launch.
it('boot screens play in order once; only skippable ones can be skipped', async () => {
  const boot = () => useSystemStore.getState().boot
  let done = false
  void title.boot().then(() => {
    done = true
  })
  expect(useSystemStore.getState().title).toBe('boot')
  await vi.advanceTimersByTimeAsync(0)
  expect(boot()).toMatchObject({ index: 0, step: 0, out: false })

  press(confirmKey) // not skippable: nothing happens
  await vi.advanceTimersByTimeAsync(600)
  expect(boot()).toMatchObject({ index: 0, out: false })
  await vi.advanceTimersByTimeAsync(500) // fade in 100 + step 1000
  expect(boot()).toMatchObject({ index: 0, out: true, fade: 100 })

  await vi.advanceTimersByTimeAsync(100)
  expect(boot()).toMatchObject({ index: 1, step: 0, out: false })
  await vi.advanceTimersByTimeAsync(100 + 500) // fade in, first still
  expect(boot()).toMatchObject({ index: 1, step: 1 })
  press(confirmKey) // skippable: fades out now, and quicker than its own fadeOut
  await vi.advanceTimersByTimeAsync(0)
  expect(boot()).toMatchObject({ index: 1, out: true, fade: 200 })
  expect(done).toBe(false)
  await vi.advanceTimersByTimeAsync(200)
  expect(done).toBe(true)
  expect(boot()).toBeNull()
  expect(useSystemStore.getState().title).toBe('boot') // black until show()

  // Return to title later: no boot screens again.
  useSystemStore.setState({ title: null })
  await title.boot()
  expect(useSystemStore.getState().title).toBeNull()
})

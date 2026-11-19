// pnpm test:browser: plays through the start of the game in a real (headless) browser at desktop
// and phone-landscape sizes, opens every engine window and fails on any error in the console.
// Pictures of each step land in build/browser-test/ for a look afterwards.
// Runs through Node type stripping: no enums, namespaces or parameter properties here.
import type { Page } from 'playwright-core'
import {
  type GamePage,
  openGame,
  SCREENS,
  type Screen,
  SHOTS,
  startSession,
  waitForGame,
  withGame,
} from './harness.ts'

const failures: string[] = []
const check = (screen: Screen, what: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : `: ${detail}`}`)
  if (!ok) failures.push(`${screen.name}: ${what}${detail ? ` (${detail})` : ''}`)
}

const system = (page: Page, expression: string) =>
  withGame<unknown>(
    page,
    `const { useSystemStore } = await import('/src/core/stores/system.ts'); const s = useSystemStore.getState(); return ${expression}`,
  )

/** Boot screens, "press any key" and the entrance, until the title menu is up. */
async function passTitle(page: Page) {
  for (let i = 0; i < 80; i++) {
    const title = await system(page, 's.title')
    const ready = await system(page, 's.titleMenuIn')
    if (title === 'menu' && ready) return
    if (title === 'boot' || title === 'intro') await withGame(page, 'game.title.skip()')
    else await page.keyboard.press('Space')
    await page.waitForTimeout(250)
  }
  throw new Error('the title menu never appeared')
}

/** Presses confirm until the running event is over (picks the first answer of any choice). */
async function playEvent(page: Page, maxPresses = 150) {
  for (let i = 0; i < maxPresses; i++) {
    if ((await system(page, 's.event === null')) === true) return true
    const choosing = await system(page, '!!s.scene.choice')
    if (choosing) await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Space')
    await page.waitForTimeout(120)
  }
  await withGame(page, 'game.events.abort()')
  return false
}

const onMapFree = `const { useSystemStore } = await import('/src/core/stores/system.ts'); const s = useSystemStore.getState(); return s.map !== null && s.mapTransition === null && s.title === null`

async function closeWindows(page: Page) {
  await withGame(page, 'game.windows.closeAll()')
  await page.waitForTimeout(150)
}

async function run(screen: Screen, game: GamePage) {
  const { page } = game
  await passTitle(page)
  await game.shot('01-title-menu')
  check(
    screen,
    'title menu shows New game',
    (await page.getByRole('button', { name: 'New game' }).count()) > 0,
  )

  await page.getByRole('button', { name: 'New game' }).click()
  await waitForGame(page, onMapFree)
  await page.waitForTimeout(600)
  await game.shot('02-first-map')
  const finished = await playEvent(page)
  check(screen, 'the intro event plays to its end with confirm', finished)
  // Anything the map starts by itself after the intro.
  await page.waitForTimeout(400)
  await playEvent(page)

  // Walking: the player moves, and the HUD with the minimap is up.
  const before = await withGame<{ x: number; y: number } | null>(
    page,
    'return game.maps.snapshot()',
  )
  for (const key of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) {
    await page.keyboard.down(key)
    await page.waitForTimeout(350)
    await page.keyboard.up(key)
  }
  await playEvent(page)
  const after = await withGame<{ x: number; y: number } | null>(page, 'return game.maps.snapshot()')
  check(
    screen,
    'the player walks with the arrow keys',
    !!before && !!after && (before.x !== after.x || before.y !== after.y),
    JSON.stringify({ before, after }),
  )

  // The rest happens in the town.
  await withGame(page, `await game.maps.go('countryside/town', { transition: 'instant' })`)
  await waitForGame(page, onMapFree)
  await page.waitForTimeout(500)
  await playEvent(page)
  check(screen, 'minimap is drawn', await page.locator('canvas[aria-hidden]').first().isVisible())
  check(
    screen,
    'chapter reached on entering the town',
    (await withGame(page, 'return game.chapters.current()')) === 'town',
  )
  check(
    screen,
    'terrain lookup works',
    (await withGame(page, 'return typeof game.maps.terrain()')) !== 'function',
  )

  // Timer on screen.
  await withGame(page, `game.timers.start('test', { seconds: 90, label: 'Test' })`)
  await page.waitForTimeout(1300)
  const timer = page.locator('[data-timer="test"]')
  const timerText = (await timer.count()) > 0 ? ((await timer.textContent()) ?? '') : ''
  check(screen, 'a countdown shows and runs', /Test\s*1:2\d/.test(timerText), timerText)
  await game.shot('03-town-hud-timer-minimap')
  await withGame(page, `game.timers.stop('test')`)

  // Emote + calendar + difficulty (no window).
  await withGame(page, `void game.maps.player.emote('surprise')`)
  await page.waitForTimeout(300)
  await game.shot('04-emote')
  check(
    screen,
    'calendar gives a date',
    /\d/.test(String(await withGame(page, 'return game.clock.dateLabel()'))),
  )

  // Camera scripts and the dev collision overlay still work on the map.
  const panned = await withGame<boolean>(
    page,
    `const before = game.maps.snapshot(); await game.maps.camera.panTo({ x: 3, y: 3 }, { duration: 150 }); await game.maps.camera.zoom(1.5, { duration: 100 }); await game.maps.camera.reset({ duration: 100 }); return !!before`,
  )
  await withGame(
    page,
    `const { useDevStore } = await import('/src/core/dev/store.ts'); useDevStore.setState({ showCollision: true })`,
  )
  await page.waitForTimeout(250)
  await game.shot('05-collision-overlay')
  await withGame(
    page,
    `const { useDevStore } = await import('/src/core/dev/store.ts'); useDevStore.setState({ showCollision: false })`,
  )
  check(screen, 'camera pan, zoom and reset finish', panned)

  // Every window: opens, has a focusable control or text, closes.
  const windows: [string, string, string?][] = [
    ['menu', `game.windows.open('menu')`],
    ['inventory', `game.windows.open('inventory')`],
    [
      'crafting',
      `game.items.add('apple', 5); game.items.add('bread', 1); game.crafting.open()`,
      'Make',
    ],
    ['travel', `game.travel.discover('forest'); game.travel.open()`, 'Forest'],
    ['settings', `game.windows.open('settings')`, 'Difficulty'],
    ['party', `game.windows.open('party')`],
    ['quests', `game.windows.open('quests')`],
    ['journal', `game.windows.open('journal')`],
    ['saves', `game.windows.open('saves', { mode: 'save' })`],
    // A save shows its chapter (src/content/chapters.ts) instead of the place.
    [
      'saves-chapter',
      `game.save.save('slot1'); game.windows.open('saves', { mode: 'load' })`,
      'Chapter 1',
    ],
  ]
  for (const [name, open, text] of windows) {
    await withGame(page, open)
    // Windows load on first use: wait for the spinner to go.
    await page.waitForTimeout(250)
    await page
      .locator('[data-closable] [role="progressbar"]')
      .waitFor({ state: 'detached', timeout: 8000 })
      .catch(() => {})
    await page.waitForTimeout(200)
    await game.shot(`10-window-${name}`)
    const dialog = page.locator('[data-closable]').last()
    const visible = (await dialog.count()) > 0 && (await dialog.isVisible())
    const hasText = !text || (await page.getByText(text, { exact: false }).count()) > 0
    // Nothing may hang off the screen: the window fits the game screen.
    const box = visible ? await dialog.boundingBox() : null
    const fits =
      !!box &&
      box.x >= -1 &&
      box.y >= -1 &&
      box.x + box.width <= screen.width + 1 &&
      box.y + box.height <= screen.height + 1
    check(
      screen,
      `window "${name}" opens, shows its content and fits the screen`,
      visible && hasText && fits,
      JSON.stringify({ visible, hasText, box }),
    )
    if (name === 'saves') {
      // The save grid is sized to fit: its window must not need scrolling.
      const extra = (await page.evaluate(
        `(() => { const c = document.querySelector('[data-window-id="saves"] [data-window-content]'); return c ? c.scrollHeight - c.clientHeight : -1 })()`,
      )) as number
      check(screen, 'the save window shows every box without scrolling', extra === 0, `${extra}px`)
    }
    await closeWindows(page)
  }

  // Extras is a full-screen minigame: opens on the tab asked for (the others stay), cancel closes it.
  await withGame(page, `void game.minigames.open('extras', { tab: 'endings' })`)
  await page.waitForTimeout(700)
  await game.shot('11-extras-minigame')
  const extrasUp = (await system(page, "s.minigame?.id === 'extras'")) === true
  const tabs = await page.locator('[data-layer="minigame"] [role="tab"]').count()
  const picked = await page
    .locator('[data-layer="minigame"] [role="tab"][aria-selected="true"]')
    .textContent()
    .catch(() => '')
  check(
    screen,
    'Extras opens as a minigame on the Endings tab, every tab still there',
    extrasUp && tabs >= 5 && picked === 'Endings',
    JSON.stringify({ extrasUp, tabs, picked }),
  )
  await page.keyboard.press('Escape')
  await page.waitForTimeout(700)
  check(screen, 'cancel closes Extras', (await system(page, 's.minigame === null')) === true)

  // A window with a transition (defineWindow transition; none by default): it stays while going out.
  await withGame(
    page,
    `const m = await import('/src/content/windows/menu/index.tsx'); m.default.transition = { in: 150, out: 600, effect: 'slideUp' }; game.windows.open('menu')`,
  )
  await page.waitForTimeout(400)
  await withGame(page, `game.windows.close('menu')`)
  await page.waitForTimeout(150)
  const going = await page.evaluate(
    `(() => { const p = document.querySelector('[role="dialog"][aria-label="Menu"]'); return p ? { inert: !!p.closest('[inert]'), id: p.getAttribute('data-window-id') } : null })()`,
  )
  await page.waitForTimeout(800)
  const gone = (await page.locator('[role="dialog"][aria-label="Menu"]').count()) === 0
  await withGame(
    page,
    `const m = await import('/src/content/windows/menu/index.tsx'); delete m.default.transition`,
  )
  check(
    screen,
    'a window with an out transition stays (no input) while it goes, then is gone',
    JSON.stringify(going) === JSON.stringify({ inert: true, id: null }) && gone,
    JSON.stringify({ going, gone }),
  )

  // Crafting really makes the item (click the button like a player).
  await withGame(
    page,
    `game.items.add('apple', 5); game.items.add('bread', 1); game.crafting.open()`,
  )
  await page.waitForTimeout(300)
  const breadBefore = await withGame<number>(page, `return game.items.count('bread')`)
  await page.getByRole('button', { name: 'Make' }).first().click()
  await page.waitForTimeout(200)
  const breadAfter = await withGame<number>(page, `return game.items.count('bread')`)
  check(
    screen,
    'the Make button crafts',
    breadAfter > breadBefore,
    `${breadBefore} -> ${breadAfter}`,
  )
  await closeWindows(page)

  // Game over: the screen cannot be closed, "Get back up" carries on.
  await withGame(page, 'void game.gameOver()')
  await page.waitForTimeout(500)
  await game.shot('20-game-over')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  check(screen, 'game over stays open on cancel', (await page.getByText('Game over').count()) > 0)
  // Keyboard only: the first button has focus, confirm picks it.
  const focused = (await page.evaluate("document.activeElement?.textContent ?? ''")) as string
  check(screen, 'game over focuses a button for keyboard / gamepad', focused.length > 0, focused)
  await page.getByRole('button', { name: 'Get back up' }).click()
  await page.waitForTimeout(300)
  check(
    screen,
    'game over closes after "Get back up"',
    (await page.getByText('Game over').count()) === 0,
  )

  // A scene: the dialogue box, then leave it.
  await withGame(page, `void game.events.start('town/sign')`)
  await page.waitForTimeout(900)
  await game.shot('30-event')
  check(screen, 'an event shows its dialogue', (await system(page, 's.event !== null')) === true)
  // Back: the scene replays behind a cover and must then draw the line it went back to.
  const firstLine = (await system(page, 's.scene.line?.text ?? ""')) as string
  await page.keyboard.press('Space')
  await page.waitForTimeout(150)
  await page.keyboard.press('Space')
  await page.waitForTimeout(500)
  const wentBack = await withGame<boolean>(page, 'return game.save.rollback()')
  await page.waitForTimeout(500)
  const lineAfter = (await system(page, 's.scene.line?.text ?? ""')) as string
  const drawn = lineAfter.length > 0 && (await page.getByText(lineAfter.slice(0, 12)).count()) > 0
  check(
    screen,
    'Back returns to the line before and draws it',
    wentBack && drawn && lineAfter.length > 0,
    JSON.stringify({ wentBack, firstLine, lineAfter, drawn }),
  )
  await game.shot('31-event-after-back')
  await withGame(page, 'game.events.abort()')

  // Side image (Settings → Text "Always"): a square inside the text box, the text beside it.
  await withGame(
    page,
    `const { useSettingsStore } = await import('/src/core/stores/settings.ts'); useSettingsStore.setState({ sideImage: 'always' }); void game.events.start('jack/hello')`,
  )
  await page.waitForTimeout(2500)
  await game.shot('32-side-image')
  const side = (await page.evaluate(`(() => {
    const face = document.querySelector('[data-side-image]')?.getBoundingClientRect()
    const box = document.querySelector('[data-dialog-box]')?.getBoundingClientRect()
    const text = document.querySelector('[data-dialog-box] .MuiTypography-root')?.getBoundingClientRect()
    return face && box && text ? { face: [face.x, face.y, face.width, face.height], box: [box.x, box.y, box.width, box.height], textLeft: text.x } : null
  })()`)) as { face: number[]; box: number[]; textLeft: number } | null
  const [fx = 0, fy = 0, fw = 0, fh = 0] = side?.face ?? []
  const [bx = 0, by = 0, , bh = 0] = side?.box ?? []
  check(
    screen,
    'side image is a square inside the text box, left of the text',
    !!side &&
      fw > 20 &&
      Math.abs(fw - fh) < 1 &&
      fy >= by - 0.5 &&
      fy + fh <= by + bh + 0.5 &&
      fx >= bx &&
      side.textLeft >= fx + fw,
    JSON.stringify(side),
  )
  await withGame(
    page,
    `game.events.abort(); const { useSettingsStore } = await import('/src/core/stores/settings.ts'); useSettingsStore.setState({ sideImage: 'offstage' })`,
  )

  // Fast travel moves to the other map.
  await withGame(page, `await game.travel.go('forest')`)
  await waitForGame(page, onMapFree)
  await page.waitForTimeout(400)
  check(
    screen,
    'fast travel changes the map',
    (await withGame(page, 'return game.maps.current()')) === 'countryside/forest',
  )
  await game.shot('40-forest')

  // Saving and loading still work with all the new state in the file.
  const saved = await withGame<boolean>(
    page,
    `game.timers.start('kept', { seconds: 500 }); game.difficulty.set('hard'); return game.save.save('slot1')`,
  )
  await withGame(
    page,
    `game.timers.stop('kept'); game.difficulty.set('normal'); await game.save.load('slot1')`,
  )
  await waitForGame(page, onMapFree)
  const restored = await withGame<string>(
    page,
    `return [game.timers.has('kept'), game.difficulty.get(), game.chapters.current(), game.travel.knows('forest')].join()`,
  )
  check(
    screen,
    'save and load keep timers, difficulty, chapter and places',
    saved && restored === 'true,hard,town,true',
    restored,
  )
  await withGame(page, `game.timers.stop('kept')`)

  // Visual novel routes and the flowchart. This test always runs with vnOnly false (the harness
  // overrides src/content/config/mode.ts), but the route runner and the window work in any mode.
  await withGame(page, `game.events.abort(); await game.routes.start('common')`)
  let atLeaving = false
  for (let i = 0; i < 80; i++) {
    // Stop ON the box: one more advance would go on to its choice, which the chart then shows.
    atLeaving = await withGame<boolean>(page, `return game.routes.current()?.key === 'leaving'`)
    if (atLeaving) break
    await withGame(
      page,
      `const d = await import('/src/core/scene/director.ts'); const { useSystemStore } = await import('/src/core/stores/system.ts'); if (useSystemStore.getState().scene.choices) d.pick(0); else d.advance()`,
    )
    await page.waitForTimeout(120)
  }
  check(screen, 'a route plays its boxes in order (common: arrival ... leaving)', atLeaving)
  await withGame(page, `game.windows.open('flowchart')`)
  await page.waitForTimeout(1200)
  const boxes = await page.locator('[data-flow-box]').count()
  const startBox = await page.evaluate<string>(`document.activeElement?.dataset?.flowBox ?? ''`)
  check(
    screen,
    'the flowchart shows the route and starts on the current box',
    boxes >= 6 && startBox === 'leaving',
    `${boxes} boxes, focus on "${startBox}"`,
  )
  await game.shot('41-flowchart')
  // Keys only (like a pad): focus the box, confirm twice, then Load in the question.
  await page.evaluate(`document.querySelector('[data-flow-box="the_choice"]')?.focus()`)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(500)
  const asked = await system(page, `s.windows.at(-1)?.id`)
  check(screen, 'confirming a picked box again asks to load it', asked === 'confirm', String(asked))
  await page.getByRole('button', { name: 'Load', exact: true }).last().focus()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1500)
  const jumped = await withGame<string>(page, `return game.routes.current()?.key ?? ''`)
  check(screen, 'picking a box twice and Load jumps there', jumped === 'the_choice', jumped)
  await withGame(page, `game.routes.stop(); game.events.abort()`)

  check(
    screen,
    'no errors in the console',
    game.errors.length === 0,
    game.errors.slice(0, 5).join(' | '),
  )
}

const session = await startSession()
try {
  for (const screen of SCREENS) {
    console.log(
      `\n${screen.name} ${screen.width}x${screen.height}${screen.touch ? ' (touch)' : ''}`,
    )
    const game = await openGame(session, screen)
    try {
      await run(screen, game)
    } catch (error) {
      await game.shot('99-crash').catch(() => {})
      check(
        screen,
        'the run finished',
        false,
        error instanceof Error ? error.message : String(error),
      )
      if (game.errors.length) console.log('  console:', game.errors.slice(0, 5).join(' | '))
    } finally {
      await game.context.close()
    }
  }
} finally {
  await session.close()
}
console.log(`\npictures: ${SHOTS}`)
if (failures.length) {
  console.error(`\n${failures.length} problem(s):\n${failures.map((f) => `  - ${f}`).join('\n')}`)
  process.exit(1)
}
console.log('\nbrowser checks passed')

// pnpm test:built: opens the BUILT web game (build/web, run `pnpm build:web` first) in a headless
// browser and fails on any console error. This is the check for things only a build has: the
// Content-Security-Policy (src/content/config/security.ts), converted media and bundled code.
// Runs through Node type stripping: no enums, namespaces or parameter properties here.
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { chromium, type Page } from 'playwright-core'
import { preview } from 'vite'
import { unlockBytes } from '../../electron/mediaLock.ts'
import { contentVnOnly, findChromium, PORT, ROOT, SCREENS, SHOTS } from './harness.ts'

const WEB = path.join(ROOT, 'build/web')
if (!existsSync(path.join(WEB, 'index.html'))) {
  console.error('build/web is missing: run `pnpm build:web` first')
  process.exit(1)
}

// The build uses src/content/config/mode.ts as it is: VN mode has no map, so it checks the story instead.
const vnOnly = contentVnOnly()
console.log(`mode: ${vnOnly ? 'VN only (src/content/config/mode.ts)' : 'normal game with maps'}`)

const server = await preview({
  root: ROOT,
  logLevel: 'error',
  preview: { port: PORT, strictPort: true, host: '127.0.0.1' },
})
const browser = await chromium.launch({
  executablePath: findChromium(),
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
})
const failures: string[] = []
/** Not the game's fault in a headless browser. */
const IGNORED = [/AudioContext/i, /favicon/i, /WebGL.*(fallback|software)/i, /GPU stall/i]

const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')

/**
 * Media lock (src/content/config/protect.ts): the service worker controls the page, a locked picture comes
 * back as the real picture, a Range request (how videos seek) gets the right bytes, a video plays to
 * its middle, and (once) a hard reload, which starts without the worker, still gets unlocked files.
 */
async function checkMediaLock(page: Page, hardReload: boolean): Promise<string[]> {
  const problems: string[] = []
  const check = (ok: boolean, label: string) => {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} media lock: ${label}`)
    if (!ok) problems.push(`media lock: ${label}`)
  }
  const { key } = JSON.parse(readFileSync(path.join(WEB, 'lock.json'), 'utf8')) as { key: string }
  const assets = readdirSync(path.join(WEB, 'assets'))
  const image = assets.find((name) => name.endsWith('.webp'))
  const video = assets.find((name) => /\.(webm|mp4)$/.test(name))
  const plainOf = (name: string) => unlockBytes(readFileSync(path.join(WEB, 'assets', name)), key)

  // Page code is text (this file is type-checked without the browser's types, like smoke.ts).
  const hashIn = (bytes: string) =>
    `[...new Uint8Array(await crypto.subtle.digest('SHA-256', ${bytes}))].map((b) => b.toString(16).padStart(2, '0')).join('')`

  const pageChecks = async () => {
    check(
      await page.evaluate<boolean>('navigator.serviceWorker?.controller != null'),
      'the worker controls the page',
    )
    if (image) {
      const result = await page.evaluate<{ hash: string; width: number }>(`(async () => {
        const bytes = new Uint8Array(await (await fetch(${JSON.stringify(`assets/${image}`)})).arrayBuffer())
        const bitmap = await createImageBitmap(new Blob([bytes])).catch(() => null)
        return { hash: ${hashIn('bytes')}, width: bitmap?.width ?? 0 }
      })()`)
      check(result.hash === sha(plainOf(image)) && result.width > 0, `a picture unlocks (${image})`)
    }
  }
  await pageChecks()

  if (video) {
    const url = JSON.stringify(`assets/${video}`)
    const plain = plainOf(video)
    const from = Math.min(1000, plain.length - 1)
    const to = Math.min(from + 4099, plain.length - 1)
    const part = await page.evaluate<{ status: number; hash: string }>(`(async () => {
      const response = await fetch(${url}, { headers: { Range: 'bytes=${from}-${to}' } })
      const bytes = new Uint8Array(await response.arrayBuffer())
      return { status: response.status, hash: ${hashIn('bytes')} }
    })()`)
    check(
      part.status === 206 && part.hash === sha(plain.subarray(from, to + 1)),
      'a Range request gets the right bytes',
    )
    const seeked = await page
      .evaluate<boolean>(`(async () => {
        const element = document.createElement('video')
        element.muted = true
        element.src = ${url}
        await new Promise((resolve, reject) => {
          element.onloadedmetadata = resolve
          element.onerror = () => reject(new Error('video error'))
        })
        element.currentTime = Number.isFinite(element.duration) ? element.duration / 2 : 1
        await new Promise((resolve) => { element.onseeked = resolve })
        return element.currentTime > 0
      })()`)
      .catch(() => false)
    check(seeked, `a video loads and seeks (${video})`)
  }

  if (hardReload) {
    // Like Shift+F5: the page starts without the worker and must ask it to take over.
    const cdp = await page.context().newCDPSession(page)
    await Promise.all([page.waitForEvent('load'), cdp.send('Page.reload', { ignoreCache: true })])
    // The page waits for the worker before it starts the game.
    await page.waitForTimeout(1500)
    console.log('  (after a hard reload)')
    await pageChecks()
    // Back to the title menu for the rest of the test.
    const newGame = page.getByRole('button', { name: 'New game' })
    for (let i = 0; i < 120 && (await newGame.count()) === 0; i++) {
      await page.keyboard.press('Space')
      await page.waitForTimeout(250)
    }
  }
  return problems
}

try {
  for (const screen of SCREENS) {
    console.log(`\n${screen.name} ${screen.width}x${screen.height}`)
    const context = await browser.newContext({
      viewport: { width: screen.width, height: screen.height },
      hasTouch: screen.touch,
      isMobile: screen.touch,
    })
    const page = await context.newPage()
    const errors: string[] = []
    const note = (text: string) => {
      if (!IGNORED.some((pattern) => pattern.test(text))) errors.push(text)
    }
    page.on('pageerror', (error) => note(`uncaught: ${error.message}`))
    page.on('console', (message) => {
      if (message.type() === 'error') note(`console: ${message.text()}`)
    })
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' })
    const policy = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute('content')
      .catch(() => null)
    console.log(
      `  policy: ${policy ? 'present' : 'none (switched off in src/content/config/security.ts)'}`,
    )

    // Boot screens and "press any key", until the title menu can be used.
    const newGame = page.getByRole('button', { name: 'New game' })
    for (let i = 0; i < 120 && (await newGame.count()) === 0; i++) {
      await page.keyboard.press('Space')
      await page.waitForTimeout(250)
    }
    const menu = (await newGame.count()) > 0
    console.log(`  ${menu ? 'ok  ' : 'FAIL'} the title menu appears`)
    if (!menu) failures.push(`${screen.name}: the title menu never appeared`)
    if (menu && existsSync(path.join(WEB, 'lock.json'))) {
      for (const problem of await checkMediaLock(page, screen.name === SCREENS[0]?.name)) {
        failures.push(`${screen.name}: ${problem}`)
      }
    }
    if (menu) {
      await page.waitForTimeout(600)
      await newGame.click()
      // The first map and its intro scene: pictures, sounds and the map canvas all load.
      await page.waitForTimeout(3000)
      // Play the intro scene to its end (first answer of any choice), so the map itself shows.
      const inScene = page.getByRole('button', { name: 'Skip', exact: true })
      if (vnOnly) {
        // A route goes on into choices and more routes: check that it starts and its lines move on.
        const started = await inScene
          .first()
          .waitFor({ timeout: 15000 })
          .then(() => true)
          .catch(() => false)
        await page.waitForTimeout(800)
        console.log(`  ${started ? 'ok  ' : 'FAIL'} the story starts`)
        if (!started) failures.push(`${screen.name}: the story did not start`)
        const text = () =>
          page
            .locator('#game-screen')
            .textContent()
            .catch(() => '')
        const before = await text()
        for (let i = 0; i < 4; i++) {
          await page.keyboard.press('Space')
          await page.waitForTimeout(400)
        }
        const moved = started && (await text()) !== before
        console.log(`  ${moved ? 'ok  ' : 'FAIL'} its lines advance with confirm`)
        if (started && !moved) failures.push(`${screen.name}: the story lines did not advance`)
      }
      if (!vnOnly) {
        for (let i = 0; i < 200 && (await inScene.count()) > 0; i++) {
          await page.keyboard.press('ArrowDown')
          await page.keyboard.press('Space')
          await page.waitForTimeout(120)
        }
        await page.waitForTimeout(1200)
        const sceneOver = (await inScene.count()) === 0
        console.log(`  ${sceneOver ? 'ok  ' : 'FAIL'} the intro scene plays to its end`)
        if (!sceneOver) failures.push(`${screen.name}: the intro scene did not end`)
        const canvas = (await page.locator('canvas').count()) > 0
        console.log(`  ${canvas ? 'ok  ' : 'FAIL'} the map is drawn`)
        if (!canvas) failures.push(`${screen.name}: no map canvas`)
      }
    }
    await page.screenshot({ path: path.join(SHOTS, `built-${screen.name}.png`) }).catch(() => {})
    const clean = errors.length === 0
    console.log(`  ${clean ? 'ok  ' : 'FAIL'} no errors in the console`)
    if (!clean) {
      for (const error of errors.slice(0, 8)) console.log(`       ${error}`)
      failures.push(`${screen.name}: ${errors.length} console error(s), first: ${errors[0]}`)
    }
    await context.close()
  }
} finally {
  await browser.close()
  await new Promise<void>((resolve) => server.httpServer.close(() => resolve()))
}
if (failures.length) {
  console.error(`\n${failures.length} problem(s):\n${failures.map((f) => `  - ${f}`).join('\n')}`)
  process.exit(1)
}
console.log('\nbuilt game checks passed')

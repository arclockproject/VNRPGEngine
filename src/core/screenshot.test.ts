// @vitest-environment happy-dom
// game.screenshot(): the file name, the toast, and that failures never throw.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const saved: { name: string; data: string }[] = []
let saveResult: string | null = '/home/me/Pictures'
vi.mock('./platform', () => ({
  saveImageFile: async (name: string, data: string) => {
    saved.push({ name, data })
    return saveResult
  },
}))
vi.mock('./world/getWorld', () => ({ peekWorld: () => null }))
let fail = false
const filters: ((node: Node) => boolean)[] = []
vi.mock('modern-screenshot', () => ({
  domToCanvas: async (_node: Node, options: { filter: (node: Node) => boolean }) => {
    if (fail) throw new Error('cannot draw')
    filters.push(options.filter)
    return document.createElement('canvas')
  },
}))

const { screenshot, captureScreen, NO_SCREENSHOT } = await import('./screenshot')
const { useToastStore } = await import('./ui/toast')
const { resetErrors, recentErrors } = await import('./errors')
const toasts = () => useToastStore.getState().toasts.map((toast) => toast.text)

function addScreen(width = 640) {
  const el = document.createElement('div')
  el.id = 'game-screen'
  Object.defineProperty(el, 'clientWidth', { value: width })
  Object.defineProperty(el, 'clientHeight', { value: (width * 9) / 16 })
  document.body.append(el)
  return el
}

beforeEach(() => {
  saved.length = 0
  filters.length = 0
  saveResult = '/home/me/Pictures'
  fail = false
  resetErrors()
  useToastStore.setState({ toasts: [] })
  // happy-dom has no real canvas drawing.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect: () => {},
    drawImage: () => {},
  } as never)
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AAAA')
})
afterEach(() => {
  document.getElementById('game-screen')?.remove()
  vi.restoreAllMocks()
})

describe('screenshot', () => {
  it('does nothing without a game screen', async () => {
    expect(await captureScreen()).toBeNull()
    expect(await screenshot()).toBe(false)
    expect(saved).toEqual([])
  })

  it('saves a dated file and says where it went', async () => {
    addScreen()
    expect(await screenshot()).toBe(true)
    expect(saved).toHaveLength(1)
    expect(saved[0]?.name).toMatch(/^.+_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.(png|jpg)$/)
    expect(saved[0]?.data.startsWith('data:image/')).toBe(true)
    expect(toasts()).toEqual(['Screenshot saved: /home/me/Pictures'])
  })

  it('a download or share has no folder to name; a cancelled share says nothing', async () => {
    addScreen()
    saveResult = ''
    expect(await screenshot()).toBe(true)
    expect(toasts()).toEqual(['Screenshot saved.'])
    useToastStore.setState({ toasts: [] })
    saveResult = null
    expect(await screenshot()).toBe(false)
    expect(toasts()).toEqual([])
  })

  it('leaves out layers marked as not for screenshots', async () => {
    addScreen()
    await captureScreen()
    const keep = document.createElement('div')
    const skip = document.createElement('div')
    skip.setAttribute(NO_SCREENSHOT, '')
    expect(filters[0]?.(keep)).toBe(true)
    expect(filters[0]?.(skip)).toBe(false)
    expect(filters[0]?.(document.createTextNode('text'))).toBe(true)
  })

  it('a failure is reported, not thrown, and the next screenshot works', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    addScreen()
    fail = true
    expect(await screenshot()).toBe(false)
    expect(recentErrors().at(-1)).toMatchObject({ where: 'screenshot', message: 'cannot draw' })
    fail = false
    expect(await screenshot()).toBe(true)
  })
})

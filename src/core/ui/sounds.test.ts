// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const sfx = vi.fn()
vi.mock('../audio/manager', () => ({ audio: { sfx } }))
vi.mock('@/content/look', () => ({
  default: {
    parts: {},
    sounds: {
      move: 'sfx/blip',
      click: { id: 'sfx/click', volume: 0.5 },
      tab: 'sfx/hit',
      close: 'sfx/confirm',
      buy: 'sfx/confirm',
    },
  },
}))

const { startUiSounds, uiSound } = await import('./sounds')
const { useSystemStore } = await import('../stores/system')

const tick = () => new Promise((resolve) => setTimeout(resolve, 5))

function add(html: string): HTMLElement {
  document.body.innerHTML = html
  return document.body.firstElementChild as HTMLElement
}

describe('UI sounds', () => {
  beforeAll(() => startUiSounds())
  beforeEach(() => sfx.mockClear())

  it('plays click on a button, with its volume', async () => {
    add('<button><span>Go</span></button>').querySelector('span')?.click()
    await tick()
    expect(sfx).toHaveBeenCalledExactlyOnceWith('sfx/click', { volume: 0.5 })
  })

  it('plays tab on a tab and nothing on plain text', async () => {
    add('<div role="tab">One</div>').click()
    await tick()
    expect(sfx).toHaveBeenCalledExactlyOnceWith('sfx/hit')
    sfx.mockClear()
    add('<p>text</p>').click()
    await tick()
    expect(sfx).not.toHaveBeenCalled()
  })

  it('lets an element pick its own sound, or none', async () => {
    add('<button data-sound="buy">Buy</button>').click()
    await tick()
    expect(sfx).toHaveBeenCalledExactlyOnceWith('sfx/confirm')
    sfx.mockClear()
    add('<button data-sound="none">Quiet</button>').click()
    await tick()
    expect(sfx).not.toHaveBeenCalled()
  })

  it('plays one sound when several happen at once: the window closing wins over the click', async () => {
    useSystemStore.setState((s) => {
      s.windows = [{ id: 'menu' } as never]
    })
    await tick()
    sfx.mockClear()
    add('<button>Close</button>').click()
    useSystemStore.setState((s) => {
      s.windows = []
    })
    await tick()
    expect(sfx).toHaveBeenCalledExactlyOnceWith('sfx/confirm')
  })

  it('plays move only when a key moved the focus, not on a click or by itself', async () => {
    const button = add('<button>A</button>')
    button.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    await tick()
    expect(sfx).not.toHaveBeenCalled()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }))
    button.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    await tick()
    expect(sfx).toHaveBeenCalledExactlyOnceWith('sfx/blip')
  })

  it('ignores names without a sound', async () => {
    uiSound('hover')
    await tick()
    expect(sfx).not.toHaveBeenCalled()
  })
})

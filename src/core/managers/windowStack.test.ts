import { describe, expect, it } from 'vitest'
import type { WindowId } from '../registry'
import type { OpenWindow } from '../stores/system'
import { bringToFront, focusWindow, removeWindow } from './windowStack'

// Plain strings stand in for real window ids here.
const id = (name: string) => name as WindowId
const ids = (stack: OpenWindow[]) => stack.map((w) => w.id as string)

describe('window stack', () => {
  it('opens windows on top, in order', () => {
    const stack: OpenWindow[] = []
    bringToFront(stack, id('a'), undefined)
    bringToFront(stack, id('b'), undefined)
    bringToFront(stack, id('c'), undefined)
    expect(ids(stack)).toEqual(['a', 'b', 'c'])
  })

  it('moves a reopened window to the front', () => {
    const stack: OpenWindow[] = []
    for (const name of ['a', 'b', 'c']) bringToFront(stack, id(name), undefined)
    removeWindow(stack, id('b'))
    bringToFront(stack, id('b'), undefined)
    expect(ids(stack)).toEqual(['a', 'c', 'b'])
  })

  it('moves an already open window to the front with new params', () => {
    const stack: OpenWindow[] = []
    bringToFront(stack, id('a'), { n: 1 })
    bringToFront(stack, id('b'), undefined)
    bringToFront(stack, id('a'), { n: 2 })
    expect(stack).toEqual([
      { id: 'b', params: undefined },
      { id: 'a', params: { n: 2 } },
    ])
  })

  it('focuses a window without changing its params', () => {
    const stack: OpenWindow[] = []
    bringToFront(stack, id('a'), { n: 1 })
    bringToFront(stack, id('b'), undefined)
    focusWindow(stack, id('a'))
    expect(stack).toEqual([
      { id: 'b', params: undefined },
      { id: 'a', params: { n: 1 } },
    ])
    focusWindow(stack, id('missing'))
    expect(ids(stack)).toEqual(['b', 'a'])
  })
})

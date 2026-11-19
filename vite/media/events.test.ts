import { describe, expect, it } from 'vitest'
import { renderEventMedia, scanEventMedia } from './events.ts'

describe('scanEventMedia', () => {
  it('lists pictures in the order the script uses them', () => {
    const code = `import { defineEvent } from '@/core/define'
import night from './night.webp'
import day from './day.png'
import data from './data.json'
export default defineEvent({
  run: async ({ say, show, background, cg }) => {
    background(day)
    show('anna', { pose: 'happy' })
    await say('anna', 'Hi')
    cg('pond_memory', 'crying.full_moon')
    background(night)
    show('anna')
    background('#000')
    background('/assets/sky.png')
    cg(null)
  },
})`
    expect(scanEventMedia(code)).toEqual([
      { kind: 'image', expr: 'day' },
      { kind: 'character', id: 'anna' },
      { kind: 'cg', id: 'pond_memory', variant: 'crying.full_moon' },
      { kind: 'image', expr: 'night' },
      { kind: 'image', expr: '"/assets/sky.png"' },
    ])
  })

  it('renders an export the game reads', () => {
    expect(
      renderEventMedia([
        { kind: 'image', expr: 'day' },
        { kind: 'cg', id: 'x' },
      ]),
    ).toContain(`export const __media = [{ kind: 'image', url: day }, { kind: 'cg', id: "x" }]`)
  })
})

import { describe, expect, it } from 'vitest'
import { isImageSource } from './imageSource'

describe('isImageSource', () => {
  it('pictures: imports, URLs, data and blob', () => {
    for (const src of [
      '/src/content/items/apple/icon.svg',
      './assets/icon-1a2b.png',
      'https://example.test/a.webp',
      'data:image/png;base64,AAAA',
      'blob:http://127.0.0.1/abc',
    ])
      expect(isImageSource(src)).toBe(true)
  })
  it('symbols and words are text', () => {
    for (const text of ['💾', '⚠', '♥', '$', 'G']) expect(isImageSource(text)).toBe(false)
  })
})

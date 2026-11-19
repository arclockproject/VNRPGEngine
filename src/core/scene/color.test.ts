// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mixColor, parseColor } from './color'

describe('parseColor', () => {
  it.each([
    ['#fff', { r: 255, g: 255, b: 255, a: 1 }],
    ['#3f3f3f', { r: 63, g: 63, b: 63, a: 1 }],
    ['#00000080', { r: 0, g: 0, b: 0, a: 128 / 255 }],
    ['rgb(10, 20, 30)', { r: 10, g: 20, b: 30, a: 1 }],
    ['rgba(0, 0, 0, 0.5)', { r: 0, g: 0, b: 0, a: 0.5 }],
    ['transparent', { r: 0, g: 0, b: 0, a: 0 }],
  ])('parses %s', (css, expected) => {
    expect(parseColor(css)).toEqual(expected)
  })
})

describe('mixColor', () => {
  it('blends two colours into #rrggbb', () => {
    expect(mixColor('#000000', '#ffffff', 0.5)).toBe('#808080')
    expect(mixColor('#f00', '#00f', 1)).toBe('#0000ff')
    expect(mixColor('rgb(255, 0, 0)', '#ff000080', 0)).toBe('#ff0000')
  })
})

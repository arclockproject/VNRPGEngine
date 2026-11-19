import { describe, expect, it } from 'vitest'
import { boxLook, lookComponents, lookPalette, lookTypography, partLook, stateLook } from './look'

const FOCUS = '&:focus-visible, &.Mui-focusVisible'

describe('boxLook', () => {
  it('is empty without a box', () => {
    expect(boxLook(undefined)).toEqual({})
  })

  it('uses the background and colour as given', () => {
    expect(boxLook({ background: 'rgba(0, 0, 0, 0.5)', color: '#fff' })).toEqual({
      background: 'rgba(0, 0, 0, 0.5)',
      color: '#fff',
    })
  })

  it('makes a 9-slice frame from an image, 16px by default', () => {
    expect(boxLook({ image: 'frame.png' })).toMatchObject({
      borderStyle: 'solid',
      borderColor: 'transparent',
      borderWidth: '16px 16px 16px 16px',
      borderImage: 'url("frame.png") 16 16 16 16 fill / 16px 16px 16px 16px stretch',
      backgroundClip: 'padding-box',
      boxShadow: 'none',
    })
  })

  it('scales the frame, takes one slice per edge, tiles sides and keeps pixels sharp', () => {
    const style = boxLook({
      image: 'f.png',
      slice: [8, 4, 8, 4],
      scale: 3,
      sides: 'round',
      pixelated: true,
    })
    expect(style.borderWidth).toBe('24px 12px 24px 12px')
    expect(style.borderImage).toBe('url("f.png") 8 4 8 4 fill / 24px 12px 24px 12px round')
    expect(style.imageRendering).toBe('pixelated')
  })

  it('draws high-res art smaller with a fractional scale, smooth by default', () => {
    const style = boxLook({ image: 'hd.png', slice: 96, scale: 0.25 })
    expect(style.borderWidth).toBe('24px 24px 24px 24px')
    expect(style.borderImage).toBe('url("hd.png") 96 96 96 96 fill / 24px 24px 24px 24px stretch')
    expect(style.imageRendering).toBeUndefined()
  })
})

describe('partLook', () => {
  it('leaves MUI states alone for a plain colour', () => {
    expect(partLook({ background: 'red' })).toEqual({ background: 'red' })
  })

  it('merges a state over the normal look, on focus and mouse hover', () => {
    const style = partLook({ image: 'a.png', color: 'white', focus: { image: 'b.png' } })
    expect(style).toHaveProperty([FOCUS, 'borderImage'], expect.stringContaining('b.png'))
    expect(style).toHaveProperty([FOCUS, 'color'], 'white')
    expect(style).toHaveProperty(['@media (hover: hover)', '&:hover', 'color'], 'white')
  })

  it('redraws the frame in every state, greyed when disabled has no picture', () => {
    const style = partLook({ image: 'a.png' })
    expect(style).toHaveProperty(
      ['&.Mui-disabled', 'borderImage'],
      expect.stringContaining('a.png'),
    )
    expect(style).toHaveProperty(['&.Mui-disabled', 'filter'], 'grayscale(1)')
    expect(style).toHaveProperty(['&:active', 'filter'], 'brightness(0.85)')
  })

  it('keeps the selected picture when a selected part is focused, with a small effect', () => {
    const style = partLook({
      image: 'a.png',
      selected: { image: 's.png' },
      focus: { color: 'gold' },
    })
    const both = '&.Mui-selected:focus-visible, &.Mui-selected.Mui-focusVisible'
    expect(style).toHaveProperty([both, 'borderImage'], expect.stringContaining('s.png'))
    expect(style).toHaveProperty([both, 'color'], 'gold')
    expect(style).toHaveProperty([both, 'filter'], 'brightness(1.25)')
    expect(style).toHaveProperty(['@media (hover: hover)', '&.Mui-selected:hover', 'color'], 'gold')
  })

  it('takes other selectors for parts with their own state classes', () => {
    const style = partLook({ focus: { color: 'gold' } }, { focus: '&.Mui-focused' })
    expect(style).toHaveProperty(['&.Mui-focused', 'color'], 'gold')
  })
})

describe('lookComponents', () => {
  it('styles every Paper and Button from the look', () => {
    const parts = lookComponents({ panel: { image: 'p.png' }, button: { all: { color: 'gold' } } })
    expect(parts.MuiPaper?.styleOverrides?.root).toMatchObject({ borderImage: expect.any(String) })
    expect(parts.MuiButton?.variants?.[0]).toEqual({
      props: { variant: 'contained', color: 'primary' },
      style: { color: 'gold' },
    })
    // 3 variants x 7 colours.
    expect(parts.MuiButton?.variants).toHaveLength(21)
  })

  it("drops MUI's focus blob only for parts with their own focus look", () => {
    const parts = lookComponents({
      button: { all: { image: 'b.png' } },
      tabs: { tab: { color: 'red' } },
    })
    expect(parts.MuiButton?.defaultProps).toEqual({ disableFocusRipple: true })
    expect(parts.MuiTab?.defaultProps).toEqual({ disableFocusRipple: false })
  })

  it('hides the tab line and the dropdown outline when asked', () => {
    const parts = lookComponents({ tabs: { indicator: 'none' }, input: { color: 'red' } })
    expect(parts.MuiTabs?.styleOverrides?.indicator).toEqual({ display: 'none' })
    expect(parts.MuiOutlinedInput?.styleOverrides?.root).toHaveProperty(
      ['& .MuiOutlinedInput-notchedOutline', 'border'],
      'none',
    )
  })
})

describe('css', () => {
  it('applies last, over what the frame sets', () => {
    const style = boxLook({
      image: 'a.png',
      slice: 4,
      css: { borderRadius: 8, padding: '2px 6px' },
    })
    expect(style).toMatchObject({
      borderWidth: '4px 4px 4px 4px',
      borderRadius: 8,
      padding: '2px 6px',
    })
  })

  it('keeps the normal css in a state, and the state css wins over it and over the effect', () => {
    const style = partLook({
      image: 'a.png',
      css: { borderRadius: 8, opacity: 0.9 },
      disabled: { css: { opacity: 0.3 } },
    }) as Record<string, object>
    expect(style['&:active']).toMatchObject({ borderRadius: 8, filter: 'brightness(0.85)' })
    expect(style['&.Mui-disabled']).toMatchObject({ borderRadius: 8, opacity: 0.3 })
  })

  it('merges a button colour over button.all, state by state', () => {
    const parts = lookComponents({
      button: {
        all: { css: { borderRadius: 8 }, focus: { image: 'focus.png', color: 'gold' } },
        primary: { image: 'primary.png', focus: { css: { letterSpacing: 1 } } },
      },
    })
    const style = parts.MuiButton?.variants?.[0]?.style as unknown as Record<string, unknown>
    expect(style.borderRadius).toBe(8)
    const focus = style['&:focus-visible, &.Mui-focusVisible'] as Record<string, unknown>
    expect(focus.borderImage).toContain('focus.png')
    expect(focus).toMatchObject({ color: 'gold', borderRadius: 8, letterSpacing: 1 })
    expect(focus.filter).toBeUndefined()
  })
})

type Variant = { props: Record<string, string>; style: Record<string, unknown> }
const buttonStyle = (parts: ReturnType<typeof lookComponents>, props: Record<string, string>) =>
  ((parts.MuiButton?.variants ?? []) as unknown as Variant[]).find(
    (v) => JSON.stringify(v.props) === JSON.stringify(props),
  )?.style

describe('button variants', () => {
  const parts = lookComponents({
    button: {
      all: { color: 'white', css: { borderRadius: 8 }, outlined: { image: 'line.png' } },
      error: { color: 'red', text: { color: 'pink' }, outlined: { css: { letterSpacing: 1 } } },
    },
  })

  it('gives one style to all three variants', () => {
    for (const variant of ['contained', 'outlined', 'text']) {
      expect(buttonStyle(parts, { variant, color: 'primary' })).toMatchObject({
        color: 'white',
        borderRadius: 8,
      })
    }
  })

  it('adds a variant on top: all, all.variant, colour, colour.variant', () => {
    expect(buttonStyle(parts, { variant: 'contained', color: 'primary' })?.borderImage).toBe(
      undefined,
    )
    const outlined = buttonStyle(parts, { variant: 'outlined', color: 'error' })
    expect(outlined?.borderImage).toContain('line.png')
    expect(outlined).toMatchObject({ color: 'red', borderRadius: 8, letterSpacing: 1 })
    expect(buttonStyle(parts, { variant: 'text', color: 'error' })?.color).toBe('pink')
    expect(buttonStyle(parts, { variant: 'text', color: 'primary' })?.color).toBe('white')
  })
})

describe('named parts', () => {
  const parts = lookComponents({
    button: { all: { color: 'white', focus: { color: 'gold' }, outlined: { image: 'no.png' } } },
    parts: { choice: { image: 'choice.png' }, cover: { background: 'black' } },
  })

  it('become Button variants that start from button.all, without its variants', () => {
    const style = buttonStyle(parts, { variant: 'choice' })
    expect(style?.borderImage).toContain('choice.png')
    expect(style?.color).toBe('white')
    expect(style).toHaveProperty([FOCUS, 'color'], 'gold')
  })

  it('become Paper variants as they are', () => {
    const variants = parts.MuiPaper?.variants as unknown as Variant[]
    expect(variants.find((v) => v.props.variant === 'cover')?.style).toEqual({
      background: 'black',
    })
  })

  it('draws one state flat for elements that pick the state themselves', () => {
    const dot = { css: { border: '1px solid' }, selected: { background: 'white' } }
    expect(stateLook(dot, 'selected')).toEqual({ border: '1px solid', background: 'white' })
    expect(stateLook(dot, 'focus')).toEqual({ border: '1px solid' })
  })
})

describe('colours and text', () => {
  it('maps the colour names onto the MUI palette and leaves unset ones out', () => {
    expect(lookPalette({ text: '#eee', accent: 'gold', onAccent: 'black', danger: 'red' })).toEqual(
      {
        mode: 'dark',
        primary: { main: 'gold', contrastText: 'black' },
        error: { main: 'red' },
        text: { primary: '#eee' },
        background: {},
      },
    )
    expect(lookPalette(undefined)).toEqual({ mode: 'dark', text: {}, background: {} })
  })

  it('passes font, base size and variant CSS to MUI typography', () => {
    expect(lookTypography({ font: 'Mine', size: 16, body2: { fontSize: 13 } })).toEqual({
      fontFamily: 'Mine',
      fontSize: 16,
      body2: { fontSize: 13 },
    })
    expect(lookTypography(undefined)).toEqual({})
  })
})

describe('other parts', () => {
  it('styles a switch, on and off', () => {
    const parts = lookComponents({
      switch: { track: { background: 'grey' }, on: { track: { background: 'green' } } },
    })
    const styles = parts.MuiSwitch?.styleOverrides as Record<string, object>
    expect(styles.track).toEqual({ opacity: 1, background: 'grey' })
    expect(styles.switchBase).toEqual({
      '&.Mui-checked + .MuiSwitch-track': { opacity: 1, background: 'green' },
    })
  })
})

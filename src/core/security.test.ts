import { describe, expect, it } from 'vitest'
import content from '@/content/config/security'
import { cspDirectives, cspText, defineSecurity } from './security'

const base = defineSecurity({ contentSecurityPolicy: { enabled: true } })
const sources = (config: Parameters<typeof cspDirectives>[0], name: string) =>
  cspDirectives(config).find(([directive]) => directive === name)?.[1]

describe('content security policy', () => {
  it('allows only the game itself by default, and no eval', () => {
    const text = cspText(base) ?? ''
    expect(text).toContain("default-src 'self'")
    expect(text).toContain("script-src 'self' 'wasm-unsafe-eval';")
    expect(text).not.toContain("'unsafe-eval'")
    expect(text).toContain("object-src 'none'")
    expect(text).toContain("frame-src 'none'")
    // Pictures made in the game and PixiJS's loader worker must keep working.
    expect(sources(base, 'img-src')).toEqual(["'self'", 'data:', 'blob:'])
    expect(sources(base, 'worker-src')).toEqual(["'self'", 'blob:'])
  })

  it('adds the extra sources from the content file', () => {
    const config = defineSecurity({
      contentSecurityPolicy: {
        enabled: true,
        allow: {
          connect: ['https://api.example.com'],
          fonts: ['https://fonts.gstatic.com'],
          frames: ['https://www.youtube.com'],
        },
        allowEval: true,
      },
    })
    expect(sources(config, 'connect-src')).toContain('https://api.example.com')
    expect(sources(config, 'font-src')).toContain('https://fonts.gstatic.com')
    expect(sources(config, 'frame-src')).toEqual(['https://www.youtube.com'])
    expect(sources(config, 'script-src')).toContain("'unsafe-eval'")
  })

  it('drops a source that would add its own rule or break the tag', () => {
    const config = defineSecurity({
      contentSecurityPolicy: {
        enabled: true,
        allow: {
          images: [
            "https://ok.example; script-src 'unsafe-inline'",
            'bad"quote',
            ' https://fine.example ',
          ],
        },
      },
    })
    expect(sources(config, 'img-src')).toEqual(["'self'", 'data:', 'blob:', 'https://fine.example'])
  })

  it("the game's own policy never allows inline or any-site scripts by accident", () => {
    const text = cspText(content)
    if (text === null) return // switched off on purpose
    const scripts = /script-src ([^;]*)/.exec(text)?.[1] ?? ''
    expect(scripts).not.toContain("'unsafe-inline'")
    expect(scripts).not.toContain('*')
  })

  it('gives nothing when switched off', () => {
    expect(cspText({ contentSecurityPolicy: { enabled: false } })).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { addCsp, cspMeta } from './csp.ts'

describe('csp in the built page', () => {
  it('goes first in <head>, before anything loads', () => {
    const html =
      '<!doctype html>\n<html>\n  <head>\n    <script src="a.js"></script>\n  </head>\n</html>'
    const out = addCsp(html, "default-src 'self'")
    expect(out.indexOf('Content-Security-Policy')).toBeLessThan(out.indexOf('<script'))
    expect(out).toContain(`content="default-src 'self'"`)
  })

  it('leaves the page alone when the policy is off', () => {
    expect(addCsp('<head></head>', null)).toBe('<head></head>')
  })

  it('escapes what could end the attribute', () => {
    expect(cspMeta('a "b" & c')).toContain('content="a &quot;b&quot; &amp; c"')
  })
})

// Types for src/content/config/security.ts, and the Content-Security-Policy text made from it. Read by the
// build (vite/csp.ts puts the policy into the built index.html, which the web, desktop and Android
// builds all load). Must not import content.

/** Extra places the game may load from, per kind. 'self' (the game's own files) is always allowed. */
export interface CspAllow {
  /** fetch(), WebSocket: e.g. 'https://api.example.com'. */
  connect?: string[]
  /** Pictures. */
  images?: string[]
  /** Sounds and videos. */
  media?: string[]
  /** Fonts. */
  fonts?: string[]
  /** Scripts. Every entry is code that runs with the game's rights: keep it empty if you can. */
  scripts?: string[]
  /** Stylesheets. */
  styles?: string[]
  /** Pages shown in an <iframe>. */
  frames?: string[]
}

export interface SecurityConfig {
  contentSecurityPolicy: {
    /** false = the built game gets no policy at all. */
    enabled: boolean
    /** Extra sources on top of the game's own files. */
    allow?: CspAllow
    /**
     * Lets scripts build code from text (eval, new Function). Off by default. Only for a library
     * that cannot work without it.
     */
    allowEval?: boolean
  }
}

export function defineSecurity(config: SecurityConfig): SecurityConfig {
  return config
}

/** A source may not smuggle in another directive or break out of the attribute. */
function clean(sources: readonly string[] | undefined): string[] {
  return (sources ?? [])
    .map((source) => source.trim())
    .filter((source) => /^[^\s;,"<>]+$/.test(source))
}

/** The policy as [directive, sources] pairs, in a fixed order. */
export function cspDirectives(config: SecurityConfig): [string, string[]][] {
  const allow = config.contentSecurityPolicy.allow ?? {}
  return [
    ['default-src', ["'self'"]],
    [
      'script-src',
      [
        "'self'",
        // Compiled code (WebAssembly) is fine; text turned into code is not, unless asked for.
        "'wasm-unsafe-eval'",
        ...(config.contentSecurityPolicy.allowEval ? ["'unsafe-eval'"] : []),
        ...clean(allow.scripts),
      ],
    ],
    // The UI library writes its styles into the page while the game runs.
    ['style-src', ["'self'", "'unsafe-inline'", ...clean(allow.styles)]],
    // data: and blob: = pictures made in the game (save pictures, screenshots, packed sprites).
    ['img-src', ["'self'", 'data:', 'blob:', ...clean(allow.images)]],
    ['media-src', ["'self'", 'data:', 'blob:', ...clean(allow.media)]],
    ['font-src', ["'self'", 'data:', ...clean(allow.fonts)]],
    ['connect-src', ["'self'", 'data:', 'blob:', ...clean(allow.connect)]],
    // PixiJS loads pictures in a worker it makes from a blob.
    ['worker-src', ["'self'", 'blob:']],
    ['frame-src', clean(allow.frames).length > 0 ? clean(allow.frames) : ["'none'"]],
    ['object-src', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['form-action', ["'none'"]],
  ]
}

/** The policy as one line, or null when it is switched off. */
export function cspText(config: SecurityConfig): string | null {
  if (!config.contentSecurityPolicy.enabled) return null
  return cspDirectives(config)
    .map(([name, sources]) => `${name} ${sources.join(' ')}`)
    .join('; ')
}

/** package.json version, injected by vite.config.ts. */
declare const __APP_VERSION__: string

/** Gallery picture URL -> thumbnail URL (made by vite/media/plugin.ts). */
declare module 'virtual:gallery-thumbnails' {
  const thumbnails: Record<string, string>
  export default thumbnails
}

/** Language -> file URL -> that file in the language ("<name>.<lang>.<ext>", vite/langFiles.ts). */
declare module 'virtual:lang-files' {
  const files: Record<string, Record<string, string>>
  export default files
}
declare module 'virtual:voice-lang-files' {
  /** One entry per video in voice-language folders: { ja: url, en: url }. */
  const files: Record<string, string>[]
  export default files
}
declare module 'virtual:variants' {
  /** This build's content variants (vite/variants.ts): group -> value, and the reworded lines. */
  const variants: { groups: Record<string, string>; strings: Record<string, string> }
  export default variants
}

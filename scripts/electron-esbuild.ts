import type { BuildOptions } from 'esbuild'

// Bundles electron/main.ts and electron/preload.ts into build/electron/main/*.cjs
export const electronBuildOptions: BuildOptions = {
  entryPoints: ['electron/main.ts', 'electron/preload.ts'],
  outdir: 'build/electron/main',
  outExtension: { '.js': '.cjs' },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['electron'],
  sourcemap: true,
  logLevel: 'info',
}

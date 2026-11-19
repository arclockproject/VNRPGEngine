import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { appPlugin, appVersion } from './vite/app.ts'
import { asepritePlugin } from './vite/aseprite/plugin.ts'
import { cspPlugin } from './vite/csp.ts'
import { hotContentPlugin } from './vite/hot.ts'
import { langFilesPlugin, voiceLangFilesPlugin } from './vite/langFiles.ts'
import { mediaPlugin } from './vite/media/plugin.ts'
import { protectPlugin } from './vite/protect.ts'
import { registryPlugin } from './vite/registry.ts'
import { spinePlugin } from './vite/spine/plugin.ts'
import { tiledPlugin } from './vite/tiled/plugin.ts'
import { variantsPlugin } from './vite/variants.ts'
import { vnPlugin } from './vite/vn/plugin.ts'

export default defineConfig({
  // Relative asset paths so the build also works from file:// inside Electron.
  base: './',
  plugins: [
    variantsPlugin(),
    appPlugin(),
    asepritePlugin(),
    spinePlugin(),
    mediaPlugin(),
    tiledPlugin(),
    vnPlugin(),
    registryPlugin(),
    langFilesPlugin(),
    voiceLangFilesPlugin(),
    hotContentPlugin(),
    cspPlugin(),
    protectPlugin(),
    react(),
  ],
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173 },
  build: {
    outDir: 'build/web',
    emptyOutDir: true,
  },
  test: {
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'vite/**/*.test.ts',
      'scripts/**/*.test.ts',
      'electron/**/*.test.ts',
    ],
    passWithNoTests: true,
  },
})

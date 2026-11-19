// Starts the Vite dev server, bundles the Electron files in watch mode,
// and (re)starts Electron whenever electron/*.ts changes.
import { type ChildProcess, spawn } from 'node:child_process'
import electronPath from 'electron'
import { context } from 'esbuild'
import { createServer } from 'vite'
import { electronBuildOptions } from './electron-esbuild.ts'

const server = await createServer()
await server.listen()
const url = server.resolvedUrls?.local[0]
if (!url) throw new Error('Vite dev server did not report a URL')
server.printUrls()

let child: ChildProcess | undefined
let restarting = false

function startElectron() {
  if (child) {
    restarting = true
    child.kill()
  }
  child = spawn(String(electronPath), ['.'], {
    stdio: 'inherit',
    env: { ...process.env, VITE_DEV_SERVER_URL: url },
  })
  child.on('exit', () => {
    if (restarting) {
      restarting = false
      return
    }
    // The Electron window was closed: stop everything.
    void ctx
      .dispose()
      .then(() => server.close())
      .then(() => process.exit(0))
  })
}

const ctx = await context({
  ...electronBuildOptions,
  plugins: [
    {
      name: 'restart-electron',
      setup(build) {
        build.onEnd((result) => {
          if (result.errors.length === 0) startElectron()
        })
      },
    },
  ],
})
await ctx.watch()

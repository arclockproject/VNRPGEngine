// Sets up Git LFS for this repo (pnpm setup:lfs): big art and sound files (.gitattributes) are
// stored as small pointers in git history, with the real files kept by the LFS server.
// git-lfs is downloaded into tools/git-lfs (not installed system-wide) and this repo's
// .git/config and hooks point at it, so it keeps working when the machine's own tools are wiped.
// Safe to run again.
import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'

const VERSION = '3.8.1'
const DIR = path.resolve('tools/git-lfs')
const isWindows = process.platform === 'win32'
const BIN = path.join(DIR, isWindows ? 'git-lfs.exe' : 'git-lfs')

function archiveName(): string {
  const arch = { x64: 'amd64', arm64: 'arm64', ia32: '386' }[process.arch as string]
  const os = { linux: 'linux', darwin: 'darwin', win32: 'windows' }[process.platform as string]
  if (!arch || !os) throw new Error(`No git-lfs download for ${process.platform}/${process.arch}.`)
  return `git-lfs-${os}-${arch}-v${VERSION}.${os === 'linux' ? 'tar.gz' : 'zip'}`
}

function run(command: string, args: string[], cwd?: string): string {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed:\n${result.stderr || result.stdout}`)
  }
  return result.stdout
}

/** Finds the git-lfs binary inside the unpacked release (it sits in a versioned folder). */
function findBinary(dir: string): string | undefined {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const found = findBinary(full)
      if (found) return found
    } else if (entry.name === path.basename(BIN)) return full
  }
  return undefined
}

async function download(): Promise<void> {
  const name = archiveName()
  const url = `https://github.com/git-lfs/git-lfs/releases/download/v${VERSION}/${name}`
  console.log(`Downloading ${url}`)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Download failed: ${response.status} ${response.statusText}`)
  const unpack = path.join(DIR, 'unpack')
  rmSync(unpack, { recursive: true, force: true })
  mkdirSync(unpack, { recursive: true })
  const archive = path.join(unpack, name)
  writeFileSync(archive, Buffer.from(await response.arrayBuffer()))
  // tar reads .zip too (bsdtar on Windows and macOS).
  run('tar', ['-xf', name], unpack)
  const binary = findBinary(unpack)
  if (!binary) throw new Error(`git-lfs not found in ${name}`)
  writeFileSync(BIN, readFileSync(binary))
  chmodSync(BIN, 0o755)
  rmSync(unpack, { recursive: true, force: true })
}

if (!existsSync(BIN)) await download()
console.log(run(BIN, ['version']).trim())

// Writes the hooks and filter config, then points them at our copy instead of "git-lfs" on PATH.
run(BIN, ['install', '--local', '--force'])
// A path relative to the repo root (git runs filters and hooks from there), never an absolute one:
// the same repo is opened from different places, and
// an absolute path from one breaks every commit of an image on the other.
const repoRoot = run('git', ['rev-parse', '--show-toplevel']).trim()
const bin = path.relative(repoRoot, BIN).split(path.sep).join('/')
run('git', ['config', '--local', 'filter.lfs.clean', `"${bin}" clean -- %f`])
run('git', ['config', '--local', 'filter.lfs.smudge', `"${bin}" smudge -- %f`])
run('git', ['config', '--local', 'filter.lfs.process', `"${bin}" filter-process`])
run('git', ['config', '--local', 'filter.lfs.required', 'true'])
const hooks = path.resolve(run('git', ['rev-parse', '--git-path', 'hooks']).trim())
for (const hook of ['pre-push', 'post-checkout', 'post-commit', 'post-merge']) {
  const file = path.join(hooks, hook)
  if (!existsSync(file)) continue
  const text = readFileSync(file, 'utf8')
    .replace(/command -v git-lfs/g, `command -v "${bin}"`)
    .replace(/^git lfs /gm, `"${bin}" `)
  writeFileSync(file, text)
}
console.log('Git LFS is set up. Files listed in .gitattributes are stored in LFS from now on.')

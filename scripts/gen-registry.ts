// Same as the Vite plugins, for use outside the dev server (typecheck, CI).
import { generateAllAseprite } from '../vite/aseprite/plugin.ts'
import { writeRegistry } from '../vite/registry.ts'
import { generateAllSpine } from '../vite/spine/plugin.ts'
import { generateAllTiled } from '../vite/tiled/plugin.ts'
import { generateAllVn } from '../vite/vn/plugin.ts'

const aseprite = generateAllAseprite(process.cwd())
const spine = generateAllSpine(process.cwd())
const tiled = generateAllTiled(process.cwd())
const vn = generateAllVn(process.cwd())
const changed = writeRegistry(process.cwd())
console.log(aseprite ? '[aseprite] updated' : '[aseprite] up to date')
console.log(spine ? '[spine] updated' : '[spine] up to date')
console.log(tiled ? '[tiled] updated' : '[tiled] up to date')
console.log(vn ? '[vn] updated' : '[vn] up to date')
console.log(changed ? '[registry] updated' : '[registry] up to date')

// PixiJS is large, so it is loaded separately: the title screen shows first,
// and Pixi downloads while the player looks at it.
import type { World } from './World'

let worldPromise: Promise<World> | undefined
let ready: World | undefined

/** The one World. Loads PixiJS and creates its Application on first use. */
export function getWorld(): Promise<World> {
  worldPromise ??= import('./World')
    .then((m) => m.createWorld())
    .then((world) => {
      ready = world
      return world
    })
  return worldPromise
}

/** The World if it exists already (no loading), e.g. for screenshots and dev tools. */
export function peekWorld(): World | undefined {
  return ready
}

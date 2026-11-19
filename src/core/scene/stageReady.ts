// Waits until the pictures on the stage now (background or CG, portraits, pictures) have loaded,
// so a chapter card that covers the stage can leave without the player seeing them pop in.
import { pictureUrls } from '../gallery'
import { useSystemStore } from '../stores/system'
import { characterUrls } from './preload'

/** A background value that is a file (not a colour or a CSS gradient). */
function isFile(url: string): boolean {
  return !/^(#|rgb|hsl|transparent$|[a-z-]+-gradient\(|[a-z]+$)/i.test(url.trim())
}

function load(url: string): Promise<void> {
  const image = new Image()
  image.src = url
  // decode() also waits for the picture to be ready to draw; a broken file just goes on.
  return image.decode().catch(() => {})
}

/** Resolves when the stage's pictures have loaded, or after `maxMs` (a slow disk never blocks). */
export function stagePicturesReady(maxMs = 3000): Promise<void> {
  const { scene } = useSystemStore.getState()
  const urls = new Set<string>()
  if (scene.background) for (const url of pictureUrls(scene.background)) urls.add(url)
  for (const actor of scene.actors) for (const url of characterUrls(actor.id)) urls.add(url)
  for (const image of scene.images) urls.add(image.src)
  const files = [...urls].filter(isFile)
  if (files.length === 0 || typeof Image === 'undefined') return Promise.resolve()
  return Promise.race([
    Promise.all(files.map(load)).then(() => {}),
    new Promise<void>((resolve) => setTimeout(resolve, maxMs)),
  ])
}

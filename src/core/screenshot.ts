// game.screenshot(): a picture of the game screen as the player sees it (map, scene, windows),
// without the dev panel, toasts, touch buttons or the black bars. Desktop: a file in the
// Pictures folder. Android: the share sheet. Browser: a download.
import screenConfig from '@/content/config/screen'
import { reportError } from './errors'
import { t } from './lang'
import { saveImageFile } from './platform'
import { toast } from './ui/toast'
import { peekWorld } from './world/getWorld'

/** Layers that must not be in a screenshot carry this attribute. */
export const NO_SCREENSHOT = 'data-no-screenshot'

let busy = false

/** The game screen as a data URL, or null if it could not be drawn. */
export async function captureScreen(): Promise<string | null> {
  const screen = typeof document === 'undefined' ? null : document.getElementById('game-screen')
  if (!screen || screen.clientWidth === 0) return null
  const config = screenConfig.screenshot
  // The map canvas is WebGL: copy it first, in this frame.
  const map = peekWorld()?.screenCanvas() ?? null
  const { domToCanvas } = await import('modern-screenshot')
  const width = config.width > 0 ? config.width : Math.round(screen.clientWidth * devicePixelRatio)
  const scale = width / screen.clientWidth
  const overlay = await domToCanvas(screen, {
    scale,
    backgroundColor: null,
    // The map layer is left out here (its canvas can't be copied later) and drawn from `map`.
    filter: (node) => !(node instanceof Element) || !node.hasAttribute(NO_SCREENSHOT),
    style: { position: 'static', margin: '0', background: 'transparent' },
  })
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = Math.max(1, Math.round(screen.clientHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) return null
  context.fillRect(0, 0, canvas.width, canvas.height)
  if (map && map.width > 0) context.drawImage(map, 0, 0, canvas.width, canvas.height)
  context.drawImage(overlay, 0, 0, canvas.width, canvas.height)
  return config.format === 'jpeg'
    ? canvas.toDataURL('image/jpeg', config.quality)
    : canvas.toDataURL('image/png')
}

const two = (n: number) => String(n).padStart(2, '0')

/** Takes a screenshot and saves it. Resolves true when a file was written / shared. */
export async function screenshot(): Promise<boolean> {
  if (busy) return false
  busy = true
  try {
    const data = await captureScreen()
    if (!data) return false
    const now = new Date()
    const stamp = `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}_${two(now.getHours())}-${two(now.getMinutes())}-${two(now.getSeconds())}`
    const name = `${screenConfig.screenshot.prefix}_${stamp}.${screenConfig.screenshot.format === 'jpeg' ? 'jpg' : 'png'}`
    const where = await saveImageFile(name, data)
    if (where === null) return false
    toast(where ? t('Screenshot saved: {where}', { where }) : t('Screenshot saved.'), {
      kind: 'screenshot',
      params: { where: where || null },
    })
    return true
  } catch (error) {
    reportError('screenshot', error)
    return false
  } finally {
    busy = false
  }
}

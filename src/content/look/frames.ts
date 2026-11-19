// The frame pictures, shared by the other look files. Swap in your own art.
// A frame is a 9-slice image: corners keep their size, sides stretch or tile, the middle fills
// the inside, so one picture fits any size. `slice` = px of the image that are frame,
// `scale` = how many times bigger it is drawn, `pixelated` = sharp pixels (pixel art).
import type { LookBox } from '@/core/look'
import buttonImage from '../assets/ui/button.png'
import buttonFocusImage from '../assets/ui/button_focus.png'
import buttonPressedImage from '../assets/ui/button_pressed.png'
import buttonErrorImage from '../assets/ui/button-error.png'
import buttonWarningImage from '../assets/ui/button-warning.png'
import panelImage from '../assets/ui/panel.png'
import progressImage from '../assets/ui/progress.png'

// Pixel art: 4px of frame in the image.
const frame = (image: string, x: number): LookBox => ({
  image,
  slice: x,
  scale: 2,
  pixelated: true,
})

export const button = frame(buttonImage, 4)
export const buttonFocus = frame(buttonFocusImage, 4)
export const buttonPressed = frame(buttonPressedImage, 4)
export const buttonError = frame(buttonErrorImage, 4)
export const buttonWarning = frame(buttonWarningImage, 4)
export const panel = frame(panelImage, 8)
export const progress: LookBox = { image: progressImage, slice: 3, pixelated: true }

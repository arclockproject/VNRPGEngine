// Named looks: the parts the engine draws itself, plus any of your own.
// Use one with  <Button variant="name">  or  <Paper variant="name">  (a Button starts from
// `all` in buttons.ts and gets none of MUI's contained / outlined styling), and on anything else
// with  sx={part('name')}  (import { part } from '@/core/ui/part').
// Add a line here and the name works (and autocompletes) everywhere, no engine change needed.
// The ones above "your own parts" are used by the engine: keep the names, change the looks. {} = no styling.
import type { LookParts } from '@/core/look'
import { gold } from './colors'
import * as frames from './frames'

const round = { borderRadius: '50%' }
const glass = 'rgba(255, 255, 255, 0.15)'

export default {
  // Event answer buttons.
  choice: { ...frames.button },
  // Title screen menu buttons.
  titleButton: { ...frames.button },
  // The dark layer behind a modal window, and behind the event log.
  cover: { background: 'rgba(0, 0, 0, 0.5)' },
  logCover: { background: 'rgba(0, 0, 0, 0.75)' },
  // Chat box text: a character's (or named speaker's) line, and narration. Keep these colours
  // solid (no rgba): "Text box opacity" fades the box behind them, not the text.
  lineText: { color: '#ffffff' },
  narrationText: { color: '#c4c4c4' },
  // Optional: added for a line the player has read before (any playthrough). Leave out to draw
  // read lines like new ones. Here they go a little softer, as in many visual novels.
  lineTextRead: { color: '#d8d0c0' },
  narrationTextRead: { color: '#a8a8a8' },
  // The full-screen chapter card (src/content/chapters.ts announce: 'card'): the cover (a chapter's
  // `image` shows behind it), the "Chapter 1" line and the title.
  chapterCard: { background: 'rgba(5, 6, 10, 0.92)' },
  chapterCardLabel: {
    color: gold,
    css: {
      letterSpacing: '0.35em',
      textTransform: 'uppercase',
      fontSize: 'clamp(13px, 2.6cqh, 22px)',
    },
  },
  chapterCardTitle: {
    color: '#ffffff',
    css: { fontSize: 'clamp(24px, 7cqh, 56px)', fontWeight: 300, letterSpacing: '0.04em' },
  },
  // The chapter's description under the title, and the see-through backdrop of an 'overlay' card
  // (chapters.ts card.style: 'overlay': the scene stays visible behind it).
  chapterCardDescription: {
    color: '#c9c9c9',
    css: { fontSize: 'clamp(13px, 2.8cqh, 20px)', maxWidth: '40em', lineHeight: 1.5 },
  },
  chapterCardOverlay: { background: 'rgba(0, 0, 0, 0.55)' },
  // The speaker's name on the chat box. A character's own colour replaces the background.
  nameTag: {
    background: '#616161',
    color: 'rgba(0, 0, 0, 0.85)',
    css: { borderRadius: 4, fontWeight: 700 },
  },
  // A character's own chat box (their file: chatBox: { box, name, text }), laid over the normal
  // one while they speak. For another frame give it a picture like frames.ts does (image, slice,
  // scale) with the same border width as the normal box (the text sits inside it); here the normal
  // frame only gets a glow in her colour. Keep text colours solid. These are Anna's
  // (src/content/characters/anna); add your own names freely.
  annaBox: {
    css: { boxShadow: '0 0 0 2px rgba(244, 143, 177, 0.9), 0 0 22px rgba(244, 143, 177, 0.55)' },
  },
  annaText: { color: '#ffe9f1' },
  // The small buttons (Back, Auto, Skip, Hide) on the chat box's top border.
  sceneToolbar: {
    background: 'rgb(15, 18, 26)',
    css: { borderRadius: 4, border: '1px solid rgba(255, 255, 255, 0.12)' },
  },
  // An answer the player has picked before (added on top of `choice`).
  choiceChosen: { css: { opacity: 0.72 } },
  // The frame around the speaker's face next to the text (src/content/scenes.ts sideImage).
  sideImage: {
    background: 'rgba(0, 0, 0, 0.35)',
    css: { borderRadius: 6, border: '1px solid rgba(255, 255, 255, 0.18)' },
  },
  // inset(): the frame around the picture in the middle of the screen (src/content/scenes.ts inset).
  inset: {
    background: '#000',
    css: {
      border: '2px solid rgba(255, 255, 255, 0.85)',
      borderRadius: 4,
      boxShadow: '0 6px 28px rgba(0, 0, 0, 0.55)',
    },
  },
  // The page of full-page text (nvl()): on top of the chat box's look.
  nvlPage: { background: 'rgba(8, 10, 16, 0.82)' },
  // A timer on screen (game.timers; settings in src/content/config/timers.ts).
  timer: {
    background: 'rgba(8, 10, 16, 0.72)',
    color: '#ffffff',
    css: { borderRadius: 8, padding: '4px 12px', fontSize: 18, fontWeight: 700 },
  },
  // Added in the last seconds of a countdown.
  timerWarning: { color: '#ff6b5e' },
  // On-screen controls for touch, and the ☰ menu button (src/content/ui/MenuButton.tsx).
  touchButton: {
    background: glass,
    color: '#fff',
    css: { ...round, border: '2px solid rgba(255, 255, 255, 0.35)', fontWeight: 700 },
    pressed: { background: 'rgba(255, 255, 255, 0.3)' },
  },
  joystick: {
    background: 'rgba(255, 255, 255, 0.1)',
    css: { ...round, border: '2px solid rgba(255, 255, 255, 0.3)' },
  },
  joystickKnob: { background: 'rgba(255, 255, 255, 0.4)', css: round },
  // Close button and caption over a full-screen picture (gallery).
  viewer: { background: 'rgba(0, 0, 0, 0.55)', color: '#fff' },
  // The dots that pick a picture variant there.
  viewerDot: {
    css: { ...round, border: '2px solid #fff' },
    selected: { background: '#fff' },
  },

  // The flowchart (visual novel mode, src/content/windows/flowchart; lines and sizes in
  // src/content/config/flowchart.ts). The "added" ones go on top of flowNode.
  flowNode: {
    background: 'rgba(255, 255, 255, 0.06)',
    css: { borderRadius: 6, border: '1px solid rgba(255, 255, 255, 0.25)' },
    focus: { background: 'rgba(255, 255, 255, 0.16)' },
  },
  flowNodeLocked: { color: 'rgba(255, 255, 255, 0.4)', css: { borderStyle: 'dashed' } },
  flowNodeSelected: { css: { outline: `2px solid ${gold}`, outlineOffset: 2 } },
  flowNodeOnPath: { background: 'rgba(242, 212, 138, 0.16)', css: { borderColor: gold } },
  flowNodeCurrent: { css: { boxShadow: '0 0 10px rgba(255, 255, 255, 0.6)' } },
  flowRouteLink: { css: { borderRadius: 16, borderWidth: 2 } },
  flowEnd: { background: 'rgba(120, 30, 30, 0.35)' },
  flowChoice: {
    background: 'rgba(242, 212, 138, 0.08)',
    css: { borderRadius: 24, borderStyle: 'double', borderWidth: 3, fontStyle: 'italic' },
  },
  flowBranch: {
    background: 'rgba(20, 24, 34, 0.95)',
    css: { border: '2px solid rgba(255, 255, 255, 0.45)', borderRadius: '3px' },
  },
  flowBranchOnPath: { background: 'rgba(242, 212, 138, 0.2)', css: { borderColor: gold } },
  flowPanel: {
    background: 'rgba(8, 10, 16, 0.6)',
    css: { borderRadius: 6, border: '1px solid rgba(255, 255, 255, 0.12)' },
  },
  flowTab: {
    background: 'rgba(255, 255, 255, 0.05)',
    css: { borderRadius: 6, border: '1px solid rgba(255, 255, 255, 0.15)' },
    focus: { background: 'rgba(255, 255, 255, 0.14)' },
    selected: { background: 'rgba(242, 212, 138, 0.2)', css: { borderColor: gold } },
  },
  flowTabHeading: {
    color: 'rgba(255, 255, 255, 0.55)',
    css: { fontSize: 12, letterSpacing: 0.5 },
  },
  flowTabDivider: {
    color: 'rgba(255, 255, 255, 0.55)',
    css: { borderTop: '1px solid rgba(255, 255, 255, 0.25)', fontSize: 12, letterSpacing: 0.5 },
  },

  // ---- your own parts below ----
  // A button that stands out: <Button variant="fancy">.
  fancy: { ...frames.buttonFocus, color: gold, css: { letterSpacing: 1 } },
} satisfies LookParts

// Chapters: labels for the story's parts. A save shows its chapter instead of the place, and
// picking a save shows the chapter's title and description, so the player knows where the
// story is before loading it. Edit freely: this is game content, not engine.
// Start one with game.chapters.reach('town') in an event or a map hook (`chapter town` in a .vn
// file). The chapter is part of the save.
import { defineChapters } from '@/core/chapters'
import { tx } from '@/core/lang'

export default defineChapters({
  // How a chapter that begins is shown: 'toast' (a small message), 'card' (the chapter card: the
  // scene waits for it), 'both', or false. A chapter can set its own announce. The card's
  // drawing: src/content/ui/ChapterCard.tsx; its look: look/parts.ts chapterCard*.
  announce: 'card',
  // The card. style 'screen' covers the stage like a VN eyecatch: in a scene, `await
  // chapter('id')` (`chapter id` in .vn) waits until it covers, the stage changes after it happen at
  // once under it, and it leaves once the new pictures have loaded. style 'overlay' = a see-through
  // backdrop with the title over the scene.
  //   ms: time on screen, fades included; fadeMs: both fades (or fadeIn / fadeOut);
  //   steps: [800, 1500] instead of ms (the card's `step` prop counts them, like a boot screen);
  //   skippable: a click / tap / confirm skips it; maskIn / maskOut: a mask transition from
  //   scenes.ts (e.g. 'irisOut') instead of the fade. A chapter can change any of these (`card`).
  card: { style: 'screen', ms: 2800, fadeMs: 600, skippable: true },
  // How the number reads ({number} = 1, or 1.2 with a sub chapter).
  label: tx('Chapter {number}'),
  // A name per chapter number, instead of `label` (flowchart lines, saves, toast). e.g. 1: tx('Spring').
  vn_chapters: { 0: tx('Prologue') },
  // Saves and the toast: number and title.
  full: tx('{label}: {title}'),

  // number (+ sub for 1.2), title, description. Ordered by number on the flowchart.
  chapters: {
    heaven: {
      number: 0,
      title: tx('Before God'),
      description: tx('Where it all starts.'),
    },
    town: {
      number: 1,
      title: tx('The town'),
      description: tx('A quiet place with a sign worth reading.'),
    },
    // The visual novel demo (src/content/routes/common).
    vn_arrival: {
      number: 1,
      title: tx('Arrival'),
      description: tx('A new town, and someone waving.'),
      card: { maskIn: 'irisOut', maskOut: 'wipeLeft', fadeMs: 900 },
    },
    vn_evening: {
      number: 1,
      sub: 2,
      title: tx('The last bus'),
      description: tx('The day is over. Stay, or go?'),
      // This one stays over the scene (see-through).
      card: { style: 'overlay', ms: 2600 },
    },
  },
})

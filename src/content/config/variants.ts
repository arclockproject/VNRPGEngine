// Content variants: one game, several versions of some of its content, picked when the game is
// built. E.g. an all-ages and an adult version, or a version for a region with its own rules
// (cigarettes drawn as lollipops). Each group has its values; a build uses one value per group:
//   pnpm build:web --variant rating=adult --variant region=cn     (left out: the group's default)
//   GAME_VARIANTS="rating=adult" pnpm dev                          (try a version while you work)
// What changes with the version (see the engine guide, Systems -> Content variants):
//   - files: cigarette.cn.png next to cigarette.png is used instead of it in the "cn" version
//     (any picture, sound, video, .aseprite or .vn file); Aseprite layers "<name>.<value>" too;
//     events/park.adult.vn replaces events/park.vn in the "adult" version.
//   - text: src/content/variants/<value>/strings.ts rewords lines (every language).
//   - scripts: game.variants.is('adult'), `if variant('adult'):` in .vn.
//   - gallery pictures, movies, endings, achievements, journal entries and replayable events with
//     `only: 'adult'` exist only in that version.
// Files and content of the other values are left out of the build (not just hidden).
// Keep this shape (the build reads it as text): group: { values: [...], default: '...' }.
// Values must be lowercase, different across all groups, and not a language folder name.
import { defineVariants } from '@/core/variants'

export default defineVariants({
  rating: { values: ['allages', 'adult'], default: 'allages' },
  region: { values: ['global', 'cn'], default: 'global' },
})

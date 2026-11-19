// Lines worded differently in the "cn" version of the game (src/content/config/variants.ts, group
// region). Key: the line as written in the scripts (English); value: how this version says it,
// in tx('…') so pnpm lang lists it for translators. Every language then translates the new line.
// Only in builds made with --variant region=cn. A demo: Jack is not allowed a nap in that version.
import { tx } from '@/core/lang'
import { defineVariantStrings } from '@/core/variants'

export default defineVariantStrings({
  'Thanks. Now I need a nap.': tx('Thanks. Now I need a lollipop.'),
})

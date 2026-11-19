// Story flags and their starting values. game.flags.get('met_anna') / set(...) are typed from this
// list, so a typo in a flag name is a type error. New flags start at their value here, also in
// old saves (no migration needed).
import { defineFlags } from '@/core/define'

export default defineFlags({
  met_anna: false,
  times_talked_to_anna: 0,
  took_jacks_letter: false,
  read_sign: false,
  // Visual novel demo (src/content/routes, used when src/content/config/mode.ts vnOnly is true).
  vn_met_anna: false,
})

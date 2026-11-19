// The define* helpers used by every file in src/content/.
// They return the config unchanged at runtime, but tag it with its parameter/result
// types so `game.windows.open('shop', { shopId: 'x' })` etc. can be type checked.
// The definitions live in core/defs/, one file per area; everything is re-exported here, so content
// and core keep importing from '@/core/define'.
export * from './defs/base'
export * from './defs/battle'
export * from './defs/maps'
export * from './defs/routes'
export * from './defs/scenes'
export * from './defs/systems'

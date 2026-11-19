import { defineProp } from '@/core/define'
// Collision comes from the "collision" slice in sprites/barrel.aseprite (just the bottom).
import sprite from './sprites/barrel.gen'

// pushable: walk against it and it slides one tile (it stays where you leave it).
export default defineProp({ sprite, pushable: true })

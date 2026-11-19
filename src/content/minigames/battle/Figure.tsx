import { Box } from '@mui/material'
import type { Fighter } from '@/core/battle/engine'
import { game } from '@/core/game'
import { SpriteImage } from '@/core/sprite/SpriteImage'
import { hurt, lungeLeft, lungeRight, type Reaction } from './animations'

/** The fighter's sprite (or a still image / colour blob for enemies without one), with a shadow. */
export function Figure({
  fighter,
  reaction,
  scale,
  facing,
}: {
  fighter: Fighter
  reaction?: Reaction
  scale: number
  facing: 'left' | 'right'
}) {
  const sprite = game.battles.sprite(fighter.side, fighter.id)
  const def = fighter.side === 'enemy' ? game.battles.enemyInfo(fighter.id) : undefined
  const down = fighter.hp <= 0
  const has = (state: string) =>
    !!sprite && Object.keys(sprite.animations).some((n) => n === state || n.startsWith(`${state}_`))
  const state = down && has('down') ? 'down' : (reaction?.state ?? 'idle')
  // Without the tag: shake when hurt, step forward when attacking.
  const move =
    reaction && !has(reaction.state)
      ? reaction.state === 'hurt'
        ? `${hurt} 250ms`
        : `${facing === 'right' ? lungeRight : lungeLeft} 350ms`
      : 'none'
  const width = sprite ? sprite.box.w * scale : 84
  return (
    <Box
      key={reaction?.n ?? 0}
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        animation: move,
        filter: down && !has('down') ? 'grayscale(1)' : 'none',
        opacity: down && !has('down') ? 0.35 : 1,
      }}
    >
      {sprite ? (
        <SpriteImage
          data={sprite}
          state={state}
          facing={facing}
          scale={scale}
          replay={reaction?.n ?? 0}
          hold={state === 'down'}
        />
      ) : (
        <Box
          sx={{
            width: 84,
            height: 64,
            borderRadius: def?.image ? 1 : '50% 50% 42% 42%',
            bgcolor: def?.image ? 'transparent' : (def?.color ?? '#9e9e9e'),
            backgroundImage: def?.image ? `url(${def.image})` : undefined,
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center bottom',
          }}
        />
      )}
      <Box
        sx={{
          width: width * 0.8,
          height: Math.max(6, scale * 2.5),
          mt: `-${Math.max(3, scale)}px`,
          borderRadius: '50%',
          bgcolor: 'rgba(0,0,0,0.35)',
          zIndex: -1,
        }}
      />
    </Box>
  )
}

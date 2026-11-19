import { alpha, Box } from '@mui/material'
import { useState } from 'react'
import screen from '@/content/config/screen'
import scenes from '@/content/scenes'
import { lang, useLang } from '../../lang'
import { LayeredPortraitView } from '../../portrait/LayeredPortraitView'
import { SpinePortraitView } from '../../portrait/SpinePortraitView'
import { actorTransform, baseFrame, getActorFx, registerActor, stagePx } from '../../scene/effects'
import type { SceneActor } from '../../scene/state'
import { type CharacterInfo, info } from './shared'

const { portraitHeight, portraitWidth } = screen.stage

/**
 * How a portrait stands (its character file's `stage`): the whole picture's CSS height, and the
 * share of it cut off at the top and hanging below the screen's bottom edge.
 *   [from, to] of the picture fills portraitHeight x scale, so the picture is that / (to - from)
 *   tall; no wider than portraitWidth x scale (then everything shrinks together).
 */
function framing(character: CharacterInfo | undefined, ratio: number | null) {
  const own = character?.stage
  // Sane values: 0 <= from < to <= 1, at least 5% of the picture (effects.ts, shared with `frame`).
  const [from, to] = baseFrame(own)
  const scale = own?.scale ?? 1
  const full = `${(portraitHeight * scale) / (to - from)}cqh`
  // ratio = width / height of the picture (unknown until a plain image has loaded).
  const height = ratio ? `min(${full}, ${(portraitWidth * scale) / ratio}cqw)` : full
  return { from, to, height, x: own?.x ?? 0, y: own?.y ?? 0 }
}

export function Actor({
  actor,
  dimmed,
  filter,
}: {
  actor: SceneActor
  dimmed: boolean
  /** Their filter or tint as CSS (scene/filters.ts), if any. */
  filter?: string
}) {
  useLang() // a new language may bring its own pictures
  const character = info(actor.id)
  const pose = actor.pose ? character?.portraits?.[actor.pose] : undefined
  const src = pose ? lang.image(pose) : undefined
  const color = character?.color ?? 'grey.500'
  const fx = getActorFx(actor.id)
  // A plain image's shape, once loaded (layered and Spine portraits know theirs).
  const [loaded, setLoaded] = useState<{ src: string; ratio: number } | null>(null)
  const drawn = character?.spine ?? character?.layered
  const ratio = drawn
    ? drawn.width / drawn.height
    : loaded && loaded.src === src
      ? loaded.ratio
      : null
  const frame = framing(character, ratio)
  const picture = character?.spine ? (
    <SpinePortraitView
      id={actor.id}
      portrait={character.spine}
      expression={actor.pose}
      parts={actor.parts}
      alt={character.name}
      height={frame.height}
    />
  ) : character?.layered ? (
    <LayeredPortraitView
      id={actor.id}
      portrait={character.layered}
      expression={actor.pose}
      parts={actor.parts}
      alt={character.name}
      height={frame.height}
    />
  ) : src ? (
    <Box
      component="img"
      src={src}
      alt={character?.name}
      draggable={false}
      onLoad={(e) => {
        const img = e.currentTarget as HTMLImageElement
        if (img.naturalHeight > 0)
          setLoaded({ src: img.currentSrc || src, ratio: img.naturalWidth / img.naturalHeight })
      }}
      sx={{ display: 'block', height: frame.height, width: 'auto' }}
    />
  ) : null
  return (
    // Outer box: position/scale/rotation/opacity, driven by animate() (see scene/effects.ts). Its
    // bottom is the screen's bottom edge, and the bottom of the shown part of the picture.
    <Box
      ref={(el: HTMLDivElement | null) => registerActor(actor.id, el)}
      style={fx ? { transform: actorTransform(fx), opacity: fx.opacity } : undefined}
      sx={{ position: 'absolute', bottom: 0, left: 0, transformOrigin: '50% 100%' }}
    >
      {/* Inner box: mirroring and dimming. */}
      <Box
        sx={{
          transform: `scaleX(${actor.flip ? -1 : 1})`,
          // The tint first, then the dimming (a url() filter does not animate; brightness does).
          filter: [
            filter ?? '',
            dimmed ? `brightness(${scenes.stage.dim.brightness})` : 'brightness(1)',
          ]
            .filter(Boolean)
            .join(' '),
          transition: `filter ${scenes.stage.dim.fadeMs}ms ease`,
        }}
      >
        {picture ? (
          // The character's `stage`: the part below `to` hangs under the screen's bottom edge,
          // the part above `from` sticks up above the shown part (negative margins). Nothing is
          // cut here: only the screen's edges cut a picture (a cut in mid-air looks wrong).
          <Box
            data-portrait-frame
            sx={{
              marginBottom: `calc(${frame.height} * ${frame.to - 1})`,
              transform:
                frame.x || frame.y ? `translate(${stagePx(frame.x)}, ${stagePx(frame.y)})` : 'none',
            }}
          >
            <Box sx={{ marginTop: `calc(${frame.height} * ${-frame.from})` }}>{picture}</Box>
          </Box>
        ) : (
          // Placeholder until the character has portraits.
          <Box
            sx={{
              width: 'min(26cqh, 28cqw)',
              height: 'min(60cqh, 680px)',
              borderRadius: '45% 45% 12px 12px',
              bgcolor: color,
              opacity: 0.85,
              display: 'grid',
              placeItems: 'center',
              fontSize: '12cqh',
              fontWeight: 800,
              color: (theme) => alpha(theme.palette.common.black, 0.35),
            }}
          >
            {character?.name.charAt(0)}
          </Box>
        )}
      </Box>
    </Box>
  )
}

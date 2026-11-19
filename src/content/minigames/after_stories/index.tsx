// The "After Stories" screen (title screen, VN mode): src/content/start.ts starts this minigame with
// game.routes.afterStories(): { available, locked, launch }. Edit freely, or replace it with your
// own screen: it only has to call params.launch(routeId) for the picked one, or finish(null) to go
// back. Each after story is a route with `afterStory` (src/content/routes/<id>); its title,
// description, image and color come from that route.
//
// Keys / pad: arrows move between cards, confirm plays one, cancel goes back. Touch / mouse: tap.
// Locked ones are drawn as a black silhouette of their picture and can't be picked.
import { keyframes } from '@emotion/react'
import { Box, Button, ButtonBase, Typography } from '@mui/material'
import { useEffect, useRef, useState } from 'react'
import {
  type AfterStoryInfo,
  type AfterStoryMenu,
  defineMinigame,
  type MinigameProps,
  type RouteId,
} from '@/core/define'
import { game } from '@/core/game'
import { useLang } from '@/core/lang'

/** How long the picked card's effect plays before the story starts, ms. */
const PICK_MS = 550
/** How a locked card's picture is drawn (CSS filter): a black silhouette. */
const LOCKED_FILTER = 'brightness(0)'
/** What a locked card shows instead of its title. */
const LOCKED_TITLE = '???'

const pop = keyframes`
  0% { transform: scale(1); }
  35% { transform: scale(1.08); }
  100% { transform: scale(1.04); }
`
const flash = keyframes`
  0% { opacity: 0.9; transform: scale(0.9); }
  100% { opacity: 0; transform: scale(1.12); }
`

function Card({
  story,
  locked,
  picked,
  onPick,
}: {
  story: AfterStoryInfo
  locked: boolean
  picked: boolean
  onPick: () => void
}) {
  const t = useLang()
  const accent = story.color ?? '#f2d48a'
  return (
    <ButtonBase
      disabled={locked}
      onClick={onPick}
      aria-label={locked ? LOCKED_TITLE : t(story.title)}
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        borderRadius: '10px',
        overflow: 'visible',
        background: locked ? '#d8d8d8' : 'rgba(255, 255, 255, 0.06)',
        border: `2px solid ${locked ? '#9a9a9a' : accent}`,
        transition: 'transform 120ms ease, box-shadow 120ms ease',
        '&:hover, &.Mui-focusVisible': locked
          ? {}
          : { transform: 'translateY(-4px)', boxShadow: `0 0 18px ${accent}` },
        '&:active': locked ? {} : { transform: 'scale(0.97)' },
        transformOrigin: 'center',
        animation: picked ? `${pop} ${PICK_MS}ms ease-out both` : undefined,
        // A locked card can't be picked: it stays fully drawn (no MUI disabled fade).
        '&.Mui-disabled': { opacity: 1 },
      }}
    >
      <Box
        sx={{
          aspectRatio: '4 / 3',
          borderRadius: '8px 8px 0 0',
          overflow: 'hidden',
          display: 'grid',
          placeItems: 'center',
          background: locked ? '#f2f2f2' : `linear-gradient(160deg, ${accent}55, transparent)`,
        }}
      >
        {story.image ? (
          <Box
            component="img"
            src={story.image}
            alt=""
            draggable={false}
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              filter: locked ? LOCKED_FILTER : undefined,
            }}
          />
        ) : (
          <Typography sx={{ fontSize: '8cqh', color: locked ? '#000' : accent }}>
            {locked ? '?' : t(story.title).slice(0, 1)}
          </Typography>
        )}
      </Box>
      <Box sx={{ p: 1, textAlign: 'left', color: locked ? '#222' : undefined }}>
        <Typography variant="subtitle2" sx={{ lineHeight: 1.2 }}>
          {locked ? LOCKED_TITLE : t(story.title)}
        </Typography>
        {!locked && story.description && (
          <Typography variant="caption" sx={{ opacity: 0.75, display: 'block', lineHeight: 1.2 }}>
            {t(story.description)}
          </Typography>
        )}
      </Box>
      {!locked && !story.played && (
        <Box
          sx={{
            position: 'absolute',
            top: 6,
            right: 6,
            px: 0.75,
            borderRadius: '4px',
            fontSize: 11,
            fontWeight: 700,
            background: accent,
            color: '#14161c',
          }}
        >
          {t('NEW')}
        </Box>
      )}
      {/* The click effect: a ring that grows and fades from the picked card. */}
      {picked && (
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: -6,
            borderRadius: '14px',
            border: `3px solid ${accent}`,
            background: 'transparent',
            transformOrigin: 'center',
            pointerEvents: 'none',
            animation: `${flash} ${PICK_MS}ms ease-out both`,
          }}
        />
      )}
    </ButtonBase>
  )
}

function AfterStories({ params, finish }: MinigameProps<AfterStoryMenu, RouteId | null>) {
  const t = useLang()
  const [picked, setPicked] = useState<RouteId | null>(null)
  // Gone (cancel pressed while the effect played): the story must not start after all.
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const pick = (id: RouteId) => {
    if (picked) return
    setPicked(id)
    game.audio.sfx('sfx/confirm')
    setTimeout(() => {
      if (alive.current) params.launch(id)
    }, PICK_MS)
  }

  const cards = [
    ...params.available.map((story) => ({ story, locked: false })),
    ...params.locked.map((story) => ({ story, locked: true })),
  ]
  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '2cqh',
        p: '4cqh 4cqw',
        boxSizing: 'border-box',
        background: 'radial-gradient(circle at 50% 0%, #2a2f45, #0d0f16 70%)',
        pointerEvents: picked ? 'none' : 'auto',
      }}
    >
      <Typography variant="h4" sx={{ textAlign: 'center', fontSize: 'clamp(20px, 6cqh, 40px)' }}>
        {t('After Stories')}
      </Typography>
      {/* Many after stories: this part scrolls. */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(120px, 20cqw, 220px), 1fr))',
          alignContent: 'start',
          gap: '2cqw',
          p: '18px', // room for the hover lift, glow and the pick ring (the scroll area clips)
        }}
      >
        {cards.map(({ story, locked }) => (
          <Card
            key={story.id}
            story={story}
            locked={locked}
            picked={picked === story.id}
            onPick={() => pick(story.id)}
          />
        ))}
      </Box>
      <Box sx={{ textAlign: 'center' }}>
        <Button
          variant="outlined"
          onClick={() => {
            game.audio.sfx('sfx/click')
            finish(null)
          }}
        >
          {t('Back')}
        </Button>
      </Box>
    </Box>
  )
}

export default defineMinigame({
  component: AfterStories,
  quitResult: null, // Esc / B goes back to the title menu
})

// The travel window (world map): game.travel.open(). Edit freely: it is game content.
// Places and the map picture: src/content/travel.ts.
import { Box, Button, Chip, Stack, Typography } from '@mui/material'
import { useState } from 'react'
import travelConfig from '@/content/travel'
import { defineWindow } from '@/core/define'
import { game } from '@/core/game'
import { tx, useLang } from '@/core/lang'
import { type PlaceView, type TravelProblem, usePlaces } from '@/core/managers/travel'

const WHY: Partial<Record<TravelProblem, string>> = {
  blocked: tx('You cannot travel from here.'),
  busy: tx('You cannot travel right now.'),
  money: tx('Not enough money.'),
}

function label(place: PlaceView) {
  return place.place.cost ? `${place.name} (${game.money.format(place.place.cost)})` : place.name
}

function Travel() {
  const t = useLang()
  const places = usePlaces()
  // What the focused place is like: shown under the map, so it needs no hover.
  const [focused, setFocused] = useState<PlaceView | null>(null)
  const { worldMap } = travelConfig
  const board = worldMap.show && places.some((p) => p.place.at)
  // The same reason for every place (a blocked map, an event): said once at the top.
  const common = places.find((p) => p.problem === 'blocked' || p.problem === 'busy')?.problem

  if (places.length === 0)
    return <Typography color="text.secondary">{t('You know no places yet.')}</Typography>

  const button = (place: PlaceView) =>
    place.here ? (
      <Chip key={place.id} color="primary" label={`${place.name}: ${t('you are here')}`} />
    ) : (
      <Button
        key={place.id}
        size="small"
        variant="contained"
        disabled={place.problem !== null}
        onFocus={() => setFocused(place)}
        onClick={() => void game.travel.go(place.id)}
      >
        {label(place)}
      </Button>
    )

  return (
    <Stack spacing={1}>
      {common && <Typography color="text.secondary">{t(WHY[common] ?? '')}</Typography>}
      {board ? (
        <Box
          sx={{
            position: 'relative',
            alignSelf: 'center',
            // As wide as the window, but never so tall that the text under it is pushed off a
            // phone screen.
            width: `min(100%, calc(40cqh * ${worldMap.ratio}))`,
            aspectRatio: String(worldMap.ratio),
            borderRadius: 1,
            overflow: 'hidden',
            background: worldMap.image
              ? `center / cover no-repeat url("${worldMap.image}")`
              : 'radial-gradient(circle at 30% 60%, #3d6b4a, #1f3a35 60%, #16262b)',
          }}
        >
          {places
            .filter((p) => p.place.at)
            .map((place) => (
              <Box
                key={place.id}
                sx={{
                  position: 'absolute',
                  left: `${place.place.at?.x ?? 50}%`,
                  top: `${place.place.at?.y ?? 50}%`,
                  transform: 'translate(-50%, -50%)',
                  whiteSpace: 'nowrap',
                }}
              >
                {button(place)}
              </Box>
            ))}
        </Box>
      ) : null}
      {/* Places without a spot on the map (or all of them, without a map) as a list. */}
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        {places.filter((p) => !board || !p.place.at).map(button)}
      </Stack>
      <Typography
        variant="body2"
        color="text.secondary"
        aria-live="polite"
        sx={{ minHeight: '1.5em' }}
      >
        {focused
          ? focused.problem === 'money'
            ? t(WHY.money ?? '')
            : focused.description
          : t('Pick a place to go to.')}
      </Typography>
    </Stack>
  )
}

export default defineWindow({ title: 'Travel', component: Travel, width: 560 })

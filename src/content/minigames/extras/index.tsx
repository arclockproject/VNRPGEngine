// Extras: gallery pictures, scene replay, movies, the music room, favourite voices, endings and
// achievements, unlocked across all saves. A full-screen minigame (not a window):
//   game.minigames.open('extras'), or open('extras', { tab: 'voices' }) to start on a tab (the
//   other tabs stay there). A tab the game does not have (no endings…) starts on the first one.
// While it is open a running scene waits under it (no auto-play, no skipping), and it takes the
// menu button: cancel (Esc / B) or menu (Start) closes it.
import { Box, Button, ButtonBase, IconButton, Stack, Tab, Tabs, Typography } from '@mui/material'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import scenes from '@/content/scenes'
import { MusicPlayer } from '@/content/ui/MusicPlayer'
import { musicPlayer, useMusicPlayer, useMusicPosition } from '@/core/audio/musicPlayer'
import { voiceLangFile, voicesKey } from '@/core/audio/voiceClips'
import { defineMinigame, type MinigameProps } from '@/core/define'
import { game } from '@/core/game'
import { useAction } from '@/core/input/useAction'
import { useTabs } from '@/core/input/useTabs'
import { lang, useLang } from '@/core/lang'
import { SHORT_SCREEN } from '@/core/layers/screen'
import {
  type GalleryEntry,
  type MovieEntry,
  type SceneEntry,
  useFavouriteVoices,
  useUnlocked,
} from '@/core/managers/extras'
import { type AudioId, registry } from '@/core/registry'
import { ImageViewer } from '@/core/ui/ImageViewer'
import { AchievementList } from '../../windows/_shared/AchievementList'

/** Asks first (spoilers), then shows every picture until Extras is closed. Nothing is saved. */
async function askRevealAll(t: ReturnType<typeof useLang>): Promise<boolean> {
  const choice = await game.dialog.ask(
    t(
      'Show every picture, scene, movie and track, also the ones you have not come across yet? This can spoil the story. They stay open until you close Extras; nothing is unlocked for good.',
    ),
    { cancel: t('Cancel'), show: t('Show all') },
  )
  return choice === 'show'
}

/** "Show all (spoilers)": asks, then shows every picture and scene until Extras closes. */
function RevealAllButton({ onRevealAll }: { onRevealAll: () => void }) {
  const t = useLang()
  return (
    <Button
      variant="outlined"
      size="small"
      onClick={() =>
        void askRevealAll(t).then((yes) => {
          if (yes) onRevealAll()
        })
      }
      sx={{ mb: 1 }}
    >
      {t('Show all (spoilers)')}
    </Button>
  )
}

/** A picture card in the gallery and scene grids (focus ring drawn inside, so scrolling can't clip it). */
const TILE_SX = {
  flexDirection: 'column',
  alignItems: 'stretch',
  borderRadius: 1,
  overflow: 'hidden',
  outline: '3px solid transparent',
  outlineOffset: '-3px',
  transition: 'outline-color 120ms',
  '&.Mui-focusVisible, &:hover': {
    outlineColor: (t: { palette: { primary: { main: string } } }) => t.palette.primary.main,
  },
  '&.Mui-focusVisible': { bgcolor: 'action.selected' },
} as const

const GRID_SX = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
  gap: 1,
} as const

/** A row of a list (music, endings, voices): the same focus ring as a card. */
const ROW_SX = {
  ...TILE_SX,
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  gap: 1.5,
  px: 1.5,
  py: 1,
  textAlign: 'left',
  bgcolor: 'action.hover',
} as const

/** A card without a picture: "?" for something still locked (no spoilers), "▶" for a scene. */
function SymbolCard({ symbol }: { symbol: '?' | '▶' }) {
  const color = symbol === '?' ? 'text.disabled' : 'inherit'
  return (
    <Box
      sx={{
        aspectRatio: '16 / 9',
        display: 'grid',
        placeItems: 'center',
        bgcolor: 'action.hover',
        fontSize: '2rem',
        color,
      }}
    >
      {symbol}
    </Box>
  )
}

function CardPicture({ src }: { src: string }) {
  return (
    <Box
      component="img"
      src={src}
      alt=""
      sx={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', display: 'block' }}
    />
  )
}

/** What every tab with unlockable things gets from the window. */
interface TabProps {
  revealAll: boolean
  onRevealAll: () => void
}

interface FrameProps {
  count: number
  locked: boolean
  onRevealAll: () => void
  children: ReactNode
}

/** A tab: "Nothing here yet." when the game has none, else "Show all" (while some are locked). */
function TabFrame(p: FrameProps) {
  const t = useLang()
  if (p.count === 0) return <Typography color="text.secondary">{t('Nothing here yet.')}</Typography>
  return (
    <>
      {p.locked && <RevealAllButton onRevealAll={p.onRevealAll} />}
      {p.children}
    </>
  )
}

interface TileProps {
  unlocked: boolean
  title: string
  picture: ReactNode
  /** After the title once unlocked (the gallery's "1/3"). */
  after?: ReactNode
  onClick: () => void
}

/** A card of a grid: its picture and title once unlocked, else "?" and "???". */
function Tile(p: TileProps) {
  const t = useLang()
  return (
    <ButtonBase disabled={!p.unlocked} onClick={p.onClick} sx={TILE_SX}>
      {p.unlocked ? p.picture : <SymbolCard symbol="?" />}
      <Typography variant="caption" sx={{ py: 0.5 }}>
        {p.unlocked ? t(p.title) : '???'}
        {p.unlocked && p.after}
      </Typography>
    </ButtonBase>
  )
}

interface RowProps {
  index: number
  unlocked: boolean
  title: string
  /** A line under the title (already translated). */
  below?: string | undefined
  start?: ReactNode
  picture?: string | undefined
  /** Makes it a button that plays something itself (no click sound). */
  onClick?: () => void
  pressed?: boolean
}

/** A numbered row (music, endings): "01", a picture, the title (??? while locked), a line under it. */
function NumberedRow(p: RowProps) {
  const t = useLang()
  const button = p.onClick
    ? { disabled: !p.unlocked, 'data-sound': 'none', 'aria-pressed': p.pressed, onClick: p.onClick }
    : {}
  return (
    <Box
      component={p.onClick ? ButtonBase : 'div'}
      {...button}
      sx={{
        ...ROW_SX,
        opacity: p.unlocked ? 1 : 0.5,
        ...(p.pressed ? { bgcolor: 'action.selected' } : {}),
      }}
    >
      {p.start}
      <Typography variant="body2" color="text.secondary" sx={{ width: 28 }}>
        {String(p.index + 1).padStart(2, '0')}
      </Typography>
      {p.picture && (
        <Box
          component="img"
          src={p.picture}
          alt=""
          sx={{ width: 72, height: 44, objectFit: 'cover', borderRadius: 0.5 }}
        />
      )}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography noWrap>{p.unlocked ? t(p.title) : '???'}</Typography>
        {p.below && (
          <Typography variant="caption" color="text.secondary">
            {p.below}
          </Typography>
        )}
      </Box>
    </Box>
  )
}

function Gallery({ revealAll, onRevealAll }: TabProps) {
  const t = useLang()
  useUnlocked()
  const images = game.extras.images(revealAll)
  // Full screen, zoomable (pinch, scroll, or hold A / B on a pad). It handles its own input.
  const [viewing, setViewing] = useState<GalleryEntry | null>(null)
  const locked = images.some((image) => image.variants.some((v) => !v.unlocked))
  return (
    <TabFrame count={images.length} locked={locked} onRevealAll={onRevealAll}>
      {viewing && (
        <ImageViewer
          pictures={viewing.variants.map((v) => ({ picture: v.picture, locked: !v.unlocked }))}
          start={Math.max(
            0,
            viewing.variants.findIndex((v) => v.unlocked),
          )}
          caption={t(viewing.title)}
          onClose={() => setViewing(null)}
        />
      )}
      <Box sx={GRID_SX}>
        {images.map((image) => (
          <Tile
            key={image.id}
            unlocked={image.unlocked}
            title={image.title}
            picture={<CardPicture src={image.thumbnail} />}
            after={
              image.variants.length > 1 && (
                <Box component="span" sx={{ ml: 0.75, opacity: 0.7 }}>
                  {image.variants.filter((v) => v.unlocked).length}/{image.variants.length}
                </Box>
              )
            }
            onClick={() => setViewing(image)}
          />
        ))}
      </Box>
    </TabFrame>
  )
}

function Scenes({ close, revealAll, onRevealAll }: TabProps & { close: () => void }) {
  useUnlocked()
  const [scenes, setScenes] = useState<SceneEntry[] | null>(null)
  useEffect(() => {
    let alive = true
    void game.extras.scenes().then((list) => alive && setScenes(list))
    return () => {
      alive = false
    }
  }, [])

  if (!scenes) return <Typography color="text.secondary">…</Typography>
  const open = (id: SceneEntry['id']) => revealAll || game.extras.sceneUnlocked(id)
  return (
    <TabFrame
      count={scenes.length}
      locked={scenes.some((scene) => !open(scene.id))}
      onRevealAll={onRevealAll}
    >
      <Box sx={GRID_SX}>
        {scenes.map((scene) => (
          <Tile
            key={scene.id}
            unlocked={open(scene.id)}
            title={scene.title}
            picture={
              scene.preview ? <CardPicture src={scene.preview} /> : <SymbolCard symbol="▶" />
            }
            onClick={() => {
              close()
              void game.extras.replay(scene.id)
            }}
          />
        ))}
      </Box>
    </TabFrame>
  )
}

/** A movie's card: its poster, or the video's first frame (silent, not playing). A ▶ on top. */
function MovieCard({ movie }: { movie: MovieEntry }) {
  const picture = { width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', display: 'block' }
  return (
    <Box sx={{ position: 'relative', bgcolor: 'common.black' }}>
      {movie.poster ? (
        <Box component="img" src={lang.image(movie.poster)} alt="" sx={picture} />
      ) : (
        // #t=0.1: browsers then show a real frame instead of a blank one.
        <Box
          component="video"
          src={`${lang.image(voiceLangFile(movie.video))}#t=0.1`}
          muted
          playsInline
          preload="metadata"
          sx={picture}
        />
      )}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          fontSize: '2rem',
          color: 'common.white',
          textShadow: '0 0 6px rgba(0, 0, 0, 0.8)',
        }}
      >
        ▶
      </Box>
    </Box>
  )
}

/**
 * Movies from src/content/movies: one unlocks when it plays in the game (movie('id')). Picking one
 * closes Extras, plays it like in a scene (src/content/events/extras/movie), then opens Extras
 * again on this tab.
 */
function Movies({ close, revealAll, onRevealAll }: TabProps & { close: () => void }) {
  useUnlocked()
  const movies = game.extras.movies(revealAll)
  return (
    <TabFrame
      count={movies.length}
      locked={movies.some((movie) => !movie.unlocked)}
      onRevealAll={onRevealAll}
    >
      <Box sx={GRID_SX}>
        {movies.map((movie) => (
          <Tile
            key={movie.id}
            unlocked={movie.unlocked}
            title={movie.title}
            picture={<MovieCard movie={movie} />}
            onClick={() => {
              close()
              void game.extras
                .playMovie(movie.id)
                .then(() => game.minigames.open('extras', { tab: 'movies' }))
            }}
          />
        ))}
      </Box>
    </TabFrame>
  )
}

/**
 * The music room: every track of src/content/scenes.ts `musicRoom`, with the player's controls
 * (src/content/ui/MusicPlayer.tsx). Picking a track plays it (picking it again pauses); the music
 * that played before comes back when the tab closes.
 */
function Music({ revealAll, onRevealAll }: TabProps) {
  const t = useLang()
  useUnlocked()
  const tracks = game.extras.music(revealAll)
  const player = useMusicPlayer()
  const position = useMusicPosition()
  // What was playing when the tab opened (title or map music), put back on the way out.
  const before = useRef(game.audio.currentMusic())
  const changed = useRef(false)
  useEffect(
    () => () => {
      if (!changed.current) return
      musicPlayer.reset()
      if (before.current) game.audio.music(before.current)
      else game.audio.stopMusic()
    },
    [],
  )
  // Next / previous / repeat all go through the tracks the player may hear.
  const playable = tracks
    .filter((track) => track.unlocked)
    .map((track) => track.id)
    .join(',')
  useEffect(
    () => musicPlayer.setList(playable ? (playable.split(',') as AudioId[]) : []),
    [playable],
  )
  const act = (action: () => void) => () => {
    changed.current = true
    action()
  }
  // Y (H on a keyboard): play / pause from anywhere on the tab.
  useAction('hide', () => {
    act(musicPlayer.toggle)()
    return true
  })

  const play = (id: AudioId) => {
    changed.current = true
    if (player.track === id) musicPlayer.toggle()
    else musicPlayer.play(id)
  }
  const title = tracks.find((track) => track.id === player.track)?.title
  return (
    <TabFrame
      count={tracks.length}
      locked={tracks.some((track) => !track.unlocked)}
      onRevealAll={onRevealAll}
    >
      <MusicPlayer
        title={title ? t(title) : null}
        playing={player.playing}
        repeat={player.repeat}
        shuffle={player.shuffle}
        positionMs={position}
        durationMs={player.durationMs}
        loopMs={player.loopMs}
        onToggle={act(musicPlayer.toggle)}
        onStop={act(musicPlayer.stop)}
        onPrevious={act(musicPlayer.previous)}
        onNext={act(musicPlayer.next)}
        onSeek={(ms) => act(() => musicPlayer.seek(ms))()}
        onRepeat={act(musicPlayer.cycleRepeat)}
        onShuffle={act(musicPlayer.toggleShuffle)}
      />
      <Stack spacing={0.5}>
        {tracks.map((track, index) => {
          const on = player.track === track.id && player.playing
          return (
            <NumberedRow
              key={track.id}
              index={index}
              unlocked={track.unlocked}
              title={track.title}
              below={track.unlocked ? track.artist : undefined}
              start={
                <Box
                  sx={{ width: 24, textAlign: 'center', color: on ? 'primary.main' : 'inherit' }}
                >
                  {on ? '■' : '▶'}
                </Box>
              }
              pressed={on}
              onClick={() => play(track.id)}
            />
          )
        })}
      </Stack>
    </TabFrame>
  )
}

/** Extras → Endings: the ways the story can end (src/content/endings). */
function Endings({ revealAll, onRevealAll }: TabProps) {
  const t = useLang()
  useUnlocked()
  const endings = game.extras.endings(revealAll)
  const found = endings.filter((ending) => ending.unlocked).length
  return (
    <TabFrame count={endings.length} locked={found < endings.length} onRevealAll={onRevealAll}>
      <Typography variant="body2" color="text.secondary">
        {t('{found} of {total} endings', { found, total: endings.length })}
      </Typography>
      <Stack spacing={0.5}>
        {endings.map((ending, index) => {
          // Reached: what happened. Not yet: the hint, if there is one.
          const below = ending.unlocked ? ending.description : ending.hint
          return (
            <NumberedRow
              key={ending.id}
              index={index}
              unlocked={ending.unlocked}
              title={ending.title}
              below={below ? t(below) : undefined}
              picture={ending.unlocked ? ending.image : undefined}
            />
          )
        })}
      </Stack>
    </TabFrame>
  )
}

/**
 * Extras → Voices: the lines the player starred in the log (src/content/scenes.ts
 * voice.favourites). Picking one plays it; the star takes it off the list.
 */
function Voices() {
  const t = useLang()
  const voices = useFavouriteVoices()
  if (voices.length === 0)
    return (
      <Typography color="text.secondary">
        {t('No favourite voices yet. Open the log in a scene and press ☆ on a voiced line.')}
      </Typography>
    )
  return (
    <Stack spacing={0.5}>
      {voices.map((line) => (
        <Stack
          key={voicesKey(line.voices)}
          direction="row"
          spacing={0.5}
          sx={{ alignItems: 'stretch' }}
        >
          <ButtonBase
            data-sound="none"
            data-favourite-voice
            onClick={() => game.extras.playFavouriteVoice(line)}
            sx={{ ...ROW_SX, flex: 1, minWidth: 0 }}
          >
            <Box sx={{ width: 24, textAlign: 'center' }}>▶</Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {line.name && (
                <Typography
                  variant="caption"
                  sx={{ color: line.color ?? 'text.secondary', fontWeight: 700 }}
                >
                  {line.name}
                </Typography>
              )}
              <Typography sx={{ overflowWrap: 'break-word' }}>{line.text}</Typography>
            </Box>
          </ButtonBase>
          <IconButton
            aria-label={t('Remove from favourite voices')}
            title={t('Remove from favourite voices')}
            onClick={() => game.extras.toggleFavouriteVoice(line)}
            sx={{ alignSelf: 'center' }}
          >
            ★
          </IconButton>
        </Stack>
      ))}
    </Stack>
  )
}

/** "Found 42%": how much of the Extras the player has unlocked (src/content/scenes.ts). */
function Found() {
  const t = useLang()
  useUnlocked()
  const done = game.extras.completion()
  if (!scenes.completion.show || done.total === 0) return null
  return (
    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'right' }}>
      {t('Found {percent}% ({found} of {total})', {
        percent: done.percent,
        found: done.found,
        total: done.total,
      })}
    </Typography>
  )
}

export type ExtrasTab =
  | 'gallery'
  | 'scenes'
  | 'movies'
  | 'music'
  | 'voices'
  | 'endings'
  | 'achievements'
const ALL_TABS: readonly ExtrasTab[] = [
  'gallery',
  'scenes',
  'movies',
  'music',
  'voices',
  'endings',
  'achievements',
]
// The Endings tab only exists when the game has endings (src/content/endings), the Voices tab
// when favourite voices are on (src/content/scenes.ts voice.favourites), the Achievements tab
// outside visual novel mode (src/content/config/mode.ts vnOnly).
const TABS = ALL_TABS.filter(
  (tab) =>
    (tab !== 'endings' || registry.endings.length > 0) &&
    (tab !== 'voices' || scenes.voice.favourites.on) &&
    (tab !== 'achievements' || !game.vnOnly),
)

function Extras({ finish, params }: MinigameProps<{ tab?: ExtrasTab } | undefined>) {
  const t = useLang()
  const close = () => finish()
  const [tab, setTab] = useState<ExtrasTab>(
    params?.tab && TABS.includes(params.tab) ? params.tab : (TABS[0] as ExtrasTab),
  )
  // "Show all" lasts until Extras closes (it lives here, not in the save).
  const [revealAll, setRevealAll] = useState(false)
  useTabs(setTab, TABS)
  // The menu button (Start) closes Extras too: the pause menu never opens over it.
  useAction('menu', () => {
    close()
    return true
  })
  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      <Stack
        spacing={2}
        sx={{
          width: '100%',
          height: '100%',
          px: { xs: 2, sm: 3 },
          pt: 2,
          pb: 0,
          [SHORT_SCREEN]: { pt: 1, gap: 1 },
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography variant="h6" sx={{ flex: 1 }} noWrap>
            {t('Extras')}
          </Typography>
          <Found />
          <IconButton aria-label={t('Close')} onClick={close}>
            ✕
          </IconButton>
        </Stack>
        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          // Five tabs don't fit a phone: they scroll there, and fill the row where there is room.
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{ '& .MuiTab-root': { flex: '1 0 auto' } }}
        >
          <Tab value="gallery" label={t('Gallery')} />
          <Tab value="scenes" label={t('Scenes')} />
          <Tab value="movies" label={t('Movies')} />
          <Tab value="music" label={t('Music')} />
          {TABS.includes('voices') && <Tab value="voices" label={t('Voices')} />}
          {TABS.includes('endings') && <Tab value="endings" label={t('Endings')} />}
          {TABS.includes('achievements') && <Tab value="achievements" label={t('Achievements')} />}
        </Tabs>
        {/* The tab's content scrolls; the title, the tabs and the ✕ stay put. */}
        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', pb: 2 }}>
          {tab === 'gallery' && (
            <Gallery revealAll={revealAll} onRevealAll={() => setRevealAll(true)} />
          )}
          {tab === 'scenes' && (
            <Scenes close={close} revealAll={revealAll} onRevealAll={() => setRevealAll(true)} />
          )}
          {tab === 'movies' && (
            <Movies close={close} revealAll={revealAll} onRevealAll={() => setRevealAll(true)} />
          )}
          {tab === 'music' && (
            <Music revealAll={revealAll} onRevealAll={() => setRevealAll(true)} />
          )}
          {tab === 'voices' && <Voices />}
          {tab === 'endings' && (
            <Endings revealAll={revealAll} onRevealAll={() => setRevealAll(true)} />
          )}
          {tab === 'achievements' && <AchievementList />}
        </Box>
      </Stack>
    </Box>
  )
}

export default defineMinigame<{ tab?: ExtrasTab } | undefined, void>({
  component: Extras,
  // Cancel (Esc / B) closes it.
  quitResult: undefined,
  // No pause menu button (☰) over it: it has its own ✕ and the menu button closes it.
  menuButton: false,
})

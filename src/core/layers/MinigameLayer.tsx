import { keyframes } from '@emotion/react'
import { Box } from '@mui/material'
import { type ComponentType, Suspense, use } from 'react'
import type { MinigameProps } from '../define'
import { InputScope } from '../input/useAction'
import { MINIGAME_FADE_MS } from '../managers/minigames'
import { loadMinigame, type MinigameId } from '../registry'
import { useSystemStore } from '../stores/system'
import { ErrorBoundary } from './ErrorBoundary'
import { Loading } from './Loading'
import { Z } from './zIndex'

const fadeIn = keyframes`from { opacity: 0 } to { opacity: 1 }`
const fadeOut = keyframes`from { opacity: 1 } to { opacity: 0 }`

/** Covers the whole screen while a minigame runs (fades in, and out after finish()). */
export function MinigameLayer() {
  const minigame = useSystemStore((s) => s.minigame)
  if (!minigame) return null
  return (
    <Box
      data-layer="minigame"
      sx={{
        position: 'absolute',
        inset: 0,
        // Started from the title screen (After Stories): over it, like a scene replayed from Extras.
        zIndex: minigame.overTitle ? Z.replay : Z.minigame,
        bgcolor: 'background.default',
        display: 'grid',
        placeItems: 'center',
        animation: `${minigame.leaving ? fadeOut : fadeIn} ${MINIGAME_FADE_MS}ms ease both`,
        pointerEvents: minigame.leaving ? 'none' : 'auto',
      }}
    >
      <ErrorBoundary
        key={minigame.id}
        label={`minigame "${minigame.id}"`}
        onDismiss={() => minigame.finish(minigame.quit?.result)}
      >
        <InputScope layer="minigame">
          <Suspense fallback={<Loading />}>
            <MinigameView id={minigame.id} params={minigame.params} finish={minigame.finish} />
          </Suspense>
        </InputScope>
      </ErrorBoundary>
    </Box>
  )
}

function MinigameView(props: { id: MinigameId; params: unknown; finish: (r: unknown) => void }) {
  const def = use(loadMinigame(props.id)) as unknown as {
    component: ComponentType<MinigameProps<unknown, unknown>>
  }
  const Component = def.component
  return <Component params={props.params} finish={props.finish} />
}

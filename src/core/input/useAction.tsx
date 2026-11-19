import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from 'react'
import type { WindowId } from '../registry'
import type { LayerName } from '../stores/system'
import { type ActionHandler, type ActionName, type ActionScope, input } from './manager'

const InputScopeContext = createContext<ActionScope>({ layers: ['map'] })

/** Set by each screen layer so useAction() inside it only fires while that layer is on top. */
export function InputScope(props: { layer: LayerName; windowId?: WindowId; children: ReactNode }) {
  const { layer, windowId } = props
  const value = useMemo(() => ({ layers: [layer], windowId }), [layer, windowId])
  return <InputScopeContext value={value}>{props.children}</InputScopeContext>
}

/**
 * Runs `handler` when `action` is pressed while this component's layer is on top
 * (inside a window: while that window is the front one). Return false to pass it on.
 * Pass `scope` to override, e.g. { layers: ['map', 'windows'] }.
 */
export function useAction(action: ActionName, handler: ActionHandler, scope?: ActionScope) {
  const context = useContext(InputScopeContext)
  const onAction = useEffectEvent(handler)
  const layers = (scope?.layers ?? context.layers ?? ['map']).join(',')
  const windowId = scope?.windowId ?? context.windowId
  useEffect(
    () =>
      input.on(action, (event) => onAction(event), {
        layers: layers.split(',') as LayerName[],
        windowId,
      }),
    [action, layers, windowId],
  )
}

/** Whether an action is held down right now (polled each frame while mounted), e.g. hold to skip. */
export function useHeld(action: ActionName): boolean {
  const [held, setHeld] = useState(false)
  useEffect(() => {
    let raf = 0
    const poll = () => {
      setHeld(input.isDown(action))
      raf = requestAnimationFrame(poll)
    }
    raf = requestAnimationFrame(poll)
    return () => cancelAnimationFrame(raf)
  }, [action])
  return held
}

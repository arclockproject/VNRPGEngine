import { Component, type ReactNode } from 'react'
import { CrashNotice } from '@/content/ui/CrashNotice'
import { reportError } from '../errors'
import { t } from '../lang'

interface Props {
  /** Shown in the message, e.g. 'window "shop"'. */
  label: string
  children: ReactNode
  /** Optional escape hatch, e.g. close the broken window. The content is then tried again. */
  onDismiss?: () => void
  /** Shows a "Try again" button that draws the content again (layers that cannot be closed). */
  retry?: boolean
}

/** Keeps one broken piece of content from taking down the whole game. */
export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    reportError(this.props.label, error)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const { onDismiss, retry, label } = this.props
    const again = () => {
      onDismiss?.()
      this.setState({ error: null })
    }
    const action =
      onDismiss || retry ? { label: onDismiss ? t('Close') : t('Try again'), run: again } : null
    const notice = {
      label,
      message: error.message,
      dev: import.meta.env.DEV,
      action,
    }
    return (
      // Layers under a boundary are often pointer-events: none; the button must still work.
      <div style={{ pointerEvents: 'auto', position: 'relative', zIndex: 1 }}>
        <PlainFallback {...notice}>
          <CrashNotice {...notice} />
        </PlainFallback>
      </div>
    )
  }
}

/** If content/ui/CrashNotice.tsx crashes as well: plain text and a plain button, nothing to break. */
class PlainFallback extends Component<
  {
    children: ReactNode
    dev: boolean
    label: string
    message: string
    action: { label: string; run: () => void } | null
  },
  { broken: boolean }
> {
  state = { broken: false }

  static getDerivedStateFromError() {
    return { broken: true }
  }

  componentDidCatch(error: Error) {
    reportError('CrashNotice', error)
  }

  render() {
    if (!this.state.broken) return this.props.children
    const { dev, label, message, action } = this.props
    return (
      <div role="alert" style={{ margin: 8, padding: 8 }}>
        {dev ? `${label} crashed: ${message}` : t('Something went wrong here.')}{' '}
        {action && (
          <button type="button" onClick={action.run}>
            {action.label}
          </button>
        )}
      </div>
    )
  }
}

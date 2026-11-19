// Shown in place of a piece of the game that crashed (a window, the map, an event), with Close or
// Try again. Edit freely, but keep it plain: if it crashes too, a bare text notice shows instead.
// Whether players are told at all (a toast too): content/config/screen.ts `errors`.
import { Alert, Button } from '@mui/material'
import { useLang } from '@/core/lang'
import type { CrashNoticeSlotProps } from '@/core/slots'

export function CrashNotice({ label, message, dev, action }: CrashNoticeSlotProps) {
  const t = useLang()
  return (
    <Alert
      severity="error"
      sx={{ m: 1 }}
      action={
        action && (
          <Button color="inherit" size="small" onClick={action.run} autoFocus>
            {action.label}
          </Button>
        )
      }
    >
      {dev ? `${label} crashed: ${message}` : t('Something went wrong here.')}
    </Alert>
  )
}

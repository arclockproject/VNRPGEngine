// Short messages from game.toast() (new quest, items received…), drawn by src/content/ui/Toast.tsx.
import { Box } from '@mui/material'
import { Toast } from '@/content/ui/Toast'
import { useToastStore } from '../ui/toast'
import { Z } from './zIndex'

export function ToastLayer() {
  const toasts = useToastStore((s) => s.toasts)
  if (toasts.length === 0) return null
  return (
    <Box
      data-no-screenshot
      sx={{ position: 'absolute', inset: 0, zIndex: Z.toast, pointerEvents: 'none' }}
    >
      <Toast toasts={toasts} />
    </Box>
  )
}

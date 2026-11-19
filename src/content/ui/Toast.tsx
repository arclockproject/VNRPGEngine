// Short messages from game.toast() ("New quest", "Got 2 apples"): where they show and how they look.
// Edit freely. How long each stays and how many show at once: src/content/config/screen.ts `toast`.
// They never catch clicks (the game under them stays usable).
// Each toast has a `kind` ('item', 'questNew', 'achievement'…) and `params` for it (the item id and
// count, the quest id…): all kinds and their params are ToastKinds in src/core/slots.ts.
import { Avatar, Box, Paper, Stack, type SxProps, type Theme, Typography } from '@mui/material'
import type { ToastInfo, ToastKind, ToastSlotProps } from '@/core/slots'
import { isImageSource } from '@/core/ui/imageSource'

/** Extra style per kind, on top of the shared look below. Empty or left out = the shared look. */
const byKind: Partial<Record<ToastKind, SxProps<Theme>>> = {
  message: {},
  item: {},
  money: {},
  questNew: {},
  questDone: {},
  achievement: {},
  ending: {},
  codex: {},
  recipe: {},
  place: {},
  chapter: {},
  partyJoin: {},
  levelUp: {},
  skillLearned: {},
  relationship: {},
  save: {},
  screenshot: {},
  error: {},
}

/**
 * Style that depends on the params, e.g. a toast of your own:
 * game.toast(game.t('Legendary!'), { params: { style: 'gold' } }) -> toast.params.style === 'gold'.
 */
function byParams(toast: ToastInfo): SxProps<Theme> {
  switch (toast.kind) {
    // e.g. case 'relationship': return toast.params.change < 0 ? { opacity: 0.8 } : {}
    default:
      return {}
  }
}

export function Toast({ toasts }: ToastSlotProps) {
  return (
    <Stack
      spacing={1}
      sx={{
        // Top centre.
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        alignItems: 'center',
        maxWidth: 'calc(100cqw - 32px)',
      }}
    >
      {toasts.map((toast) => (
        <Paper
          key={toast.id}
          elevation={6}
          sx={[
            {
              px: 2,
              py: 1,
              display: 'flex',
              gap: 1,
              alignItems: 'center',
              '@keyframes toastIn': {
                from: { opacity: 0, transform: 'translateY(-8px)' },
                to: { opacity: 1, transform: 'none' },
              },
              animation: 'toastIn 200ms ease-out',
            },
            ...sxList(byKind[toast.kind] ?? {}),
            ...sxList(byParams(toast)),
          ]}
        >
          {/* An icon is a picture (item icon) or a symbol ('💾', '⚠'). */}
          {toast.icon &&
            (isImageSource(toast.icon) ? (
              <Avatar
                src={toast.icon}
                variant="square"
                sx={{ width: 24, height: 24, imageRendering: 'pixelated', bgcolor: 'transparent' }}
              />
            ) : (
              <Box
                component="span"
                aria-hidden
                sx={{ width: 24, fontSize: 20, lineHeight: '24px', textAlign: 'center' }}
              >
                {toast.icon}
              </Box>
            ))}
          <Typography variant="body2">{toast.text}</Typography>
        </Paper>
      ))}
    </Stack>
  )
}

/** MUI's way to merge several sx: one list. */
function sxList(sx: SxProps<Theme>) {
  return Array.isArray(sx) ? sx : [sx]
}

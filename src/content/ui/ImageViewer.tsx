// The controls over a full-screen picture (gallery, Extras): the ✕, the dots for a CG's variants,
// the caption and the hints. Edit freely. Zoom limits, speeds and the background:
// src/content/config/screen.ts `imageViewer`. Zoom, pan and swipe stay with the engine.
// Anything clickable must be a button (ButtonBase / Button), or a press on it moves the picture.
import { Box, ButtonBase, Typography } from '@mui/material'
import { ActionHint } from '@/core/input/ActionHint'
import { useLang } from '@/core/lang'
import type { ImageViewerSlotProps } from '@/core/slots'
import { part } from '@/core/ui/part'

export function ImageViewer({
  caption,
  device,
  switchable,
  variants,
  index,
  select,
  close,
}: ImageViewerSlotProps) {
  const t = useLang()
  return (
    <>
      <ButtonBase
        aria-label={t('Close')}
        onClick={close}
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          width: 44,
          height: 44,
          borderRadius: '50%',
          fontSize: '1.4rem',
          ...part('viewer'),
        }}
      >
        ✕
      </ButtonBase>
      <Box
        sx={{
          position: 'absolute',
          left: '50%',
          bottom: 8,
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.5,
          maxWidth: 'calc(100% - 16px)',
          pointerEvents: 'none',
        }}
      >
        {variants.length > 1 && (
          <Box
            role="tablist"
            aria-label={t('Variants')}
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              px: 0.5,
              borderRadius: 2,
              pointerEvents: 'auto',
              ...part('viewer'),
            }}
          >
            {variants.map((variant, i) => (
              <ButtonBase
                // biome-ignore lint/suspicious/noArrayIndexKey: the variants never reorder
                key={i}
                role="tab"
                aria-selected={i === index}
                aria-label={variant.locked ? '???' : `${i + 1} / ${variants.length}`}
                disabled={variant.locked}
                tabIndex={-1}
                onClick={() => select(i)}
                // Big enough to tap, the dot itself stays small.
                sx={{ width: 28, height: 28, borderRadius: '50%' }}
              >
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    opacity: variant.locked ? 0.35 : 1,
                    ...(i === index ? part('viewerDot', 'selected') : part('viewerDot')),
                  }}
                />
              </ButtonBase>
            ))}
          </Box>
        )}
        <Box
          sx={{
            px: 1.5,
            py: 0.5,
            borderRadius: 1,
            textAlign: 'center',
            ...part('viewer'),
          }}
        >
          {caption && <Typography variant="body2">{caption}</Typography>}
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            {device === 'touch' ? (
              switchable ? (
                t('Pinch to zoom, swipe to switch')
              ) : (
                t('Pinch to zoom')
              )
            ) : (
              <>
                {t('Zoom')}
                <ActionHint action="confirm" />
                {switchable && (
                  <>
                    <Box component="span" sx={{ ml: 2 }}>
                      {t('Switch')}
                    </Box>
                    <ActionHint action="left" />
                    <ActionHint action="right" />
                  </>
                )}
                <Box component="span" sx={{ ml: 2 }}>
                  {t('Back')}
                </Box>
                <ActionHint action="cancel" />
              </>
            )}
          </Typography>
        </Box>
      </Box>
    </>
  )
}

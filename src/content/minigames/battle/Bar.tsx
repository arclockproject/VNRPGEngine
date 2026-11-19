import { LinearProgress } from '@mui/material'

/** A thin HP (error) or MP (info) bar. */
export function Bar({
  value,
  max,
  color,
}: {
  value: number
  max: number
  color: 'error' | 'info'
}) {
  return (
    <LinearProgress
      variant="determinate"
      color={color}
      value={max > 0 ? (value / max) * 100 : 0}
      sx={{ borderRadius: 3 }}
    />
  )
}

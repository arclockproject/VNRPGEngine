// The SVG colour matrices the scene's tints use (scene/filters.ts): one <filter> per colour, used
// as `filter: url(#tint-…)` by the stage, the background and the portraits. Draws nothing itself.
import { tintId } from '../../scene/filters'

export function TintDefs({ scales }: { scales: readonly (readonly [number, number, number])[] }) {
  if (scales.length === 0) return null
  return (
    <svg
      aria-hidden
      width="0"
      height="0"
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
    >
      <defs>
        {scales.map((scale) => (
          <filter key={tintId(scale)} id={tintId(scale)} colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values={`${scale[0]} 0 0 0 0  0 ${scale[1]} 0 0 0  0 0 ${scale[2]} 0 0  0 0 0 1 0`}
            />
          </filter>
        ))}
      </defs>
    </svg>
  )
}

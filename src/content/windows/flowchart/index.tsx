// The flowchart (visual novel mode, src/content/config/mode.ts): every route's boxes, which ones were
// reached, and loading the story from one of them. Opened from the pause menu. Edit freely: this is
// game content. Sizes, lines and wording: src/content/config/flowchart.ts; box looks: the flow* parts in
// src/content/look/parts.ts; box titles and descriptions: src/content/routes/<route>/flow.ts.
//
// Keys / pad: arrows move between boxes (the side panel shows the box), confirm picks it (the way
// through it lights up), confirm again loads it. LB / RB (Q / R) switch routes. Touch: tap, tap again.
import { Box, Button, ButtonBase, Stack, Typography } from '@mui/material'
import { type SetStateAction, useEffect, useRef } from 'react'
import { defineWindow, type RouteId } from '@/core/define'
import { type FlowchartLine, flowImageDirection } from '@/core/flowchart'
import { game } from '@/core/game'
import { useTabs } from '@/core/input/useTabs'
import { useLang } from '@/core/lang'
import {
  type FlowBox,
  type FlowBranch,
  type FlowLine,
  useFlowchart,
} from '@/core/routes/useFlowchart'
import { type PartName, part } from '@/core/ui/part'

/** Space around the chart, px (so focus rings and arrows are never cut off). */
const PAD = 16

type Chart = ReturnType<typeof useFlowchart>

/**
 * An SVG path through the line's points, in the configured shape. Each stretch goes down, across,
 * down; a line leaving a diamond's side goes across first, then down.
 */
function linePath(line: FlowLine, shape: Chart['config']['shape'], corner: number): string {
  const [first, ...rest] = line.points
  if (!first) return ''
  let d = `M ${first[0]} ${first[1]}`
  let [px, py] = first
  rest.forEach(([x, y], i) => {
    const sx = Math.sign(x - px)
    if (shape === 'straight') d += ` L ${x} ${y}`
    else if (i === 0 && line.side) {
      // Across from the diamond's corner, then down into the box.
      if (shape === 'curve') d += ` Q ${x} ${py} ${x} ${y}`
      else if (shape === 'elbow') d += ` H ${x} V ${y}`
      else {
        const c = Math.max(0, Math.min(corner, Math.abs(x - px), y - py))
        d += ` H ${x - sx * c} Q ${x} ${py} ${x} ${py + c} V ${y}`
      }
    } else if (x === px) d += ` V ${y}`
    else {
      // Where it runs across: the layout's height (lanes, flow.ts bend), else halfway.
      const mid = line.bends?.[i] ?? (py + y) / 2
      if (shape === 'curve') d += ` C ${px} ${mid} ${x} ${mid} ${x} ${y}`
      else if (shape === 'elbow') d += ` V ${mid} H ${x} V ${y}`
      else {
        const c = Math.max(0, Math.min(corner, Math.abs(x - px) / 2, mid - py, y - mid))
        d +=
          ` V ${mid - c} Q ${px} ${mid} ${px + sx * c} ${mid}` +
          ` H ${x - sx * c} Q ${x} ${mid} ${x} ${mid + c} V ${y}`
      }
    }
    px = x
    py = y
  })
  return d
}

/**
 * Where a line's text goes on its first stretch: just under the box it leaves, where it runs across
 * (halfway), or just over the box it reaches. Returns the text's middle and baseline.
 */
function labelAt(line: FlowLine, at: Chart['config']['labels'], size: number): [number, number] {
  const [x0, y0] = line.points[0] ?? [0, 0]
  const [x1, y1] = line.points[1] ?? [x0, y0]
  if (at === 'start') return [x0, y0 + size + 2]
  if (at === 'end') return [x1, y1 - 4]
  return [(x0 + x1) / 2, (line.bends?.[0] ?? (y0 + y1) / 2) + size / 3]
}

/**
 * Developers only (content/config/flowchart.ts `debug`, dev builds): rows, columns and px for flow.ts
 * `row` / `column` / `shift` / `via`, and the key of every box and diamond (unseen ones too).
 */
function DebugGrid({ chart }: { chart: Chart }) {
  const { layout, config } = chart
  if (!layout || !config.debug || !import.meta.env.DEV) return null
  const { origin, step, rows } = layout.grid
  const first = Math.floor(-origin / step)
  const last = Math.ceil((layout.width - origin) / step)
  const columns = Array.from({ length: last - first + 1 }, (_, i) => first + i)
  const ink = config.choiceLabel?.color ?? config.pathLine.color
  return (
    <svg
      width={layout.width + PAD * 2}
      height={layout.height + PAD * 2}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}
    >
      <title>Flowchart debug grid</title>
      <g transform={`translate(${PAD} ${PAD})`} fontSize={9} fill={ink}>
        {columns.map((c) => {
          const cx = origin + c * step
          return (
            <g key={`c${c}`}>
              <line
                x1={cx}
                y1={0}
                x2={cx}
                y2={layout.height}
                stroke={ink}
                strokeOpacity={0.25}
                strokeDasharray="2 4"
              />
              <text x={cx + 2} y={-4}>{`col ${c} · ${Math.round(cx)}`}</text>
            </g>
          )
        })}
        {rows.map((r, i) => (
          <g key={`r${r.top}`}>
            <rect
              x={0}
              y={r.top}
              width={layout.width}
              height={r.height}
              fill={ink}
              fillOpacity={0.05}
            />
            <text x={-PAD + 1} y={r.top + 10}>{`r${i}`}</text>
            <text x={-PAD + 1} y={r.top + 20}>
              {Math.round(r.top)}
            </text>
          </g>
        ))}
        {layout.boxes.map((b) => (
          <text key={b.key} x={b.x} y={b.y - 2} stroke="black" strokeWidth={2} paintOrder="stroke">
            {b.key}
          </text>
        ))}
      </g>
    </svg>
  )
}

/** Chapter lines: "Chapter 1" over a line across the whole chart (one per chapter number). */
function ChapterLines({ chart }: { chart: Chart }) {
  const { layout, config } = chart
  const look = config.chapters
  if (!layout || !look) return null
  const shown = chart.chapters.filter((c) => c.seen || config.unseen !== 'hidden')
  return (
    <svg
      width={layout.width + PAD * 2}
      height={layout.height + PAD * 2}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <title>Flowchart chapters</title>
      <g transform={`translate(${PAD} ${PAD})`}>
        {shown.map((c) => {
          const y = c.top + c.height - look.line.width
          return (
            <g key={c.number}>
              <text x={0} y={y - 6} fontSize={look.size} fill={look.color}>
                {c.label}
              </text>
              <line
                x1={-PAD / 2}
                x2={layout.width + PAD / 2}
                y1={y}
                y2={y}
                stroke={look.line.color}
                strokeWidth={look.line.width}
                strokeDasharray={look.line.dash?.join(' ')}
              />
            </g>
          )
        })}
      </g>
    </svg>
  )
}

function Lines({ chart }: { chart: Chart }) {
  const t = useLang()
  const { config, layout, lines } = chart
  if (!layout) return null
  const style = (line: FlowLine): FlowchartLine => ({
    ...(line.onPath ? config.pathLine : line.locked ? config.lockedLine : config.line),
    ...line.look,
  })
  const kinds: [string, FlowchartLine][] = [
    ['line', config.line],
    ['path', config.pathLine],
    ['locked', config.lockedLine],
  ]
  // Lines on the way are drawn last, so they are on top. Hidden-style charts still draw every line
  // leaving a reached box (dashed into a box not reached, which stays invisible), but nothing that
  // starts from a box not reached: the chart never shows past the first unseen box.
  const ordered = [...lines]
    .filter((line) => !(line.fromUnseen && config.unseen === 'hidden'))
    .sort((a, b) => Number(a.onPath) - Number(b.onPath))
  const label = config.choiceLabel
  return (
    <svg
      width={layout.width + PAD * 2}
      height={layout.height + PAD * 2}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <title>Flowchart lines</title>
      <defs>
        {kinds.map(([id, s]) => (
          <marker
            key={id}
            id={`flow-arrow-${id}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={s.color} />
          </marker>
        ))}
      </defs>
      <g transform={`translate(${PAD} ${PAD})`}>
        {ordered.map((line) => {
          const s = style(line)
          const kind = line.onPath ? 'path' : line.locked ? 'locked' : 'line'
          return (
            <path
              key={`${line.from}>${line.to}`}
              d={linePath(line, config.shape, config.corner)}
              fill="none"
              stroke={s.color}
              strokeWidth={s.width}
              strokeDasharray={s.dash?.join(' ')}
              markerEnd={config.arrows ? `url(#flow-arrow-${kind})` : undefined}
            />
          )
        })}
        {/* The picked option of a choice, halfway down its first stretch (branches are furthest
            apart there, so labels don't run into each other). */}
        {label &&
          ordered.map((line) => {
            if (!line.label) return null
            const [lx, ly] = labelAt(line, config.labels, label.size)
            return (
              <text
                key={`label:${line.from}>${line.to}`}
                x={lx + (line.labelShift?.x ?? 0)}
                y={ly + (line.labelShift?.y ?? 0)}
                textAnchor="middle"
                fontSize={label.size}
                fill={label.color}
                stroke={label.outline}
                strokeWidth={3}
                paintOrder="stroke"
              >
                {t(line.label)}
              </text>
            )
          })}
      </g>
    </svg>
  )
}

/** A flag() / check() diamond: a square turned 45 degrees in the middle of its space. */
function Diamond({ chart, branch }: { chart: Chart; branch: FlowBranch }) {
  const { config } = chart
  if (!branch.seen && config.unseen === 'hidden') return null
  const side = branch.size / Math.SQRT2
  return (
    <Box
      aria-hidden
      sx={[
        part('flowBranch'),
        branch.onPath ? part('flowBranchOnPath') : {},
        {
          position: 'absolute',
          left: branch.x + PAD + (branch.size - side) / 2,
          top: branch.y + PAD + (branch.size - side) / 2,
          width: side,
          height: side,
          transform: 'rotate(45deg)',
          pointerEvents: 'none',
          opacity: branch.seen ? 1 : 0.5,
        },
      ]}
    />
  )
}

function FlowBoxButton({ chart, box, onLoad }: { chart: Chart; box: FlowBox; onLoad: () => void }) {
  const t = useLang()
  const { config } = chart
  // Not reached yet, hidden style: keeps its place but can't be seen, picked or focused.
  const hidden = !box.seen && config.unseen === 'hidden'
  const { width, height, image: imageAt } = config.node
  const title = box.seen ? t(box.title) : t(config.text.locked)
  const image = box.seen && imageAt !== 'none' ? box.image : undefined
  const looks: (PartName | false | undefined)[] = [
    !box.seen && 'flowNodeLocked',
    box.kind === 'route' && 'flowRouteLink',
    box.kind === 'end' && 'flowEnd',
    box.kind === 'choice' && 'flowChoice',
    box.onPath && 'flowNodeOnPath',
    box.current && 'flowNodeCurrent',
    chart.selected?.key === box.key && 'flowNodeSelected',
    box.seen && (box.look as PartName | undefined),
  ]
  const color = box.link ? chart.tabs.find((tab) => tab.id === box.link)?.color : undefined
  return (
    <ButtonBase
      data-flow-box={box.key}
      aria-label={title}
      aria-hidden={hidden || undefined}
      disabled={hidden}
      tabIndex={hidden ? -1 : 0}
      onFocus={() => chart.focus(box.key)}
      onClick={() => {
        if (chart.pick(box.key)) onLoad()
      }}
      sx={[
        part('flowNode'),
        ...looks.map((name) => (name ? part(name) : {})),
        color ? { borderColor: color } : {},
        hidden ? { visibility: 'hidden' } : {},
        {
          position: 'absolute',
          left: box.x + PAD,
          top: box.y + PAD,
          width,
          height,
          px: 1,
          gap: 1,
          display: 'flex',
          flexDirection: flowImageDirection(imageAt),
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
        },
      ]}
    >
      {image && (
        <Box
          component="img"
          src={image}
          alt=""
          sx={{
            height: imageAt === 'top' || imageAt === 'bottom' ? '50%' : height - 12,
            aspectRatio: '1',
            objectFit: 'cover',
          }}
        />
      )}
      <Typography
        variant="body2"
        sx={{
          lineHeight: 1.2,
          textAlign: 'center',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {box.kind === 'route' && box.seen ? `→ ${title}` : title}
      </Typography>
    </ButtonBase>
  )
}

function SidePanel({ chart, onLoad }: { chart: Chart; onLoad: () => void }) {
  const t = useLang()
  const box = chart.selected
  const { text } = chart.config
  const routeTitle = chart.tabs.find((tab) => tab.id === chart.route)?.title
  return (
    <Box
      sx={[
        part('flowPanel'),
        {
          width: `${chart.config.panel.width * 100}%`,
          flexShrink: 0,
          p: 1.5,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          overflowY: 'auto',
        },
      ]}
    >
      {box?.seen && box.image && (
        <Box component="img" src={box.image} alt="" sx={{ width: '100%', borderRadius: 1 }} />
      )}
      <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
        {box ? (box.seen ? t(box.title) : t(text.locked)) : ''}
      </Typography>
      {routeTitle && (
        <Typography variant="caption" color="text.secondary">
          {t(routeTitle)}
        </Typography>
      )}
      {box?.seen && box.description && (
        <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
          {t(box.description)}
        </Typography>
      )}
      <Box sx={{ flex: 1 }} />
      {(box?.kind === 'event' || box?.kind === 'choice') &&
        (box.loadable ? (
          <Button variant="contained" onClick={onLoad}>
            {t(text.load)}
          </Button>
        ) : (
          <Typography variant="caption" color={box.unreachable ? 'warning.main' : 'text.secondary'}>
            {t(box.unreachable ? text.noWay : text.cannotLoad)}
          </Typography>
        ))}
    </Box>
  )
}

function RouteTab({ chart, tab }: { chart: Chart; tab: Chart['tabs'][number] }) {
  const t = useLang()
  const open = tab.id === chart.route
  const imageAt = chart.config.tabs.image
  const across = imageAt === 'left' || imageAt === 'right'
  return (
    <ButtonBase
      aria-pressed={open}
      onClick={() => chart.setRoute(tab.id)}
      sx={[
        part('flowTab'),
        open ? part('flowTab', 'selected') : {},
        tab.color ? { borderColor: tab.color } : {},
        { p: 1, flexDirection: flowImageDirection(imageAt), gap: 0.5, flexShrink: 0 },
      ]}
    >
      {imageAt !== 'none' && tab.image && (
        <Box
          component="img"
          src={tab.image}
          alt=""
          sx={{
            width: across ? '40%' : '100%',
            aspectRatio: across ? '1' : '16 / 9',
            objectFit: 'cover',
            borderRadius: 0.5,
            flexShrink: 0,
          }}
        />
      )}
      <Typography variant="body2" sx={{ lineHeight: 1.2 }}>
        {t(tab.title)}
      </Typography>
    </ButtonBase>
  )
}

/**
 * The route tabs: the main story's, then a line and the after stories' (routes with `afterStory`
 * and the routes they move on to). Each group scrolls by itself when it has many tabs.
 */
function RouteTabs({ chart }: { chart: Chart }) {
  const t = useLang()
  const main = chart.tabs.filter((tab) => !tab.afterStory)
  const after = chart.tabs.filter((tab) => tab.afterStory)
  const { routes: routesHeading, afterStories: heading } = chart.config.text
  const group = (list: typeof main) => (
    <Stack spacing={1} sx={{ minHeight: 0, flex: '0 1 auto', overflowY: 'auto', p: '2px' }}>
      {list.map((tab) => (
        <RouteTab key={tab.id} chart={chart} tab={tab} />
      ))}
    </Stack>
  )
  return (
    <Stack spacing={1} sx={{ flexShrink: 0, width: 112, minHeight: 0 }}>
      {routesHeading && (
        <Box sx={[part('flowTabHeading'), { flexShrink: 0, textAlign: 'center' }]}>
          {t(routesHeading)}
        </Box>
      )}
      {group(main)}
      {after.length > 0 && (
        <>
          <Box
            role="separator"
            sx={[part('flowTabDivider'), { flexShrink: 0, pt: 0.5, textAlign: 'center' }]}
          >
            {heading ? t(heading) : null}
          </Box>
          {group(after)}
        </>
      )}
    </Stack>
  )
}

function Flowchart() {
  const t = useLang()
  const chart = useFlowchart()
  const { config, layout } = chart
  const order = chart.tabs.map((tab) => tab.id)
  useTabs<RouteId>((next: SetStateAction<RouteId>) => {
    chart.setRoute(typeof next === 'function' ? next(chart.route) : next)
  }, order)

  const load = async () => {
    const yes = await game.dialog.ask(t(config.text.loadQuestion), {
      cancel: t('Cancel'),
      load: t(config.text.load),
    })
    if (yes === 'load') await chart.load()
  }

  // Keys / pad start on the selected box (where the story is), also after switching routes.
  const chartRef = useRef<HTMLDivElement>(null)
  const ready = layout !== null && chart.selected !== null
  // biome-ignore lint/correctness/useExhaustiveDependencies: only when a route's chart appears
  useEffect(() => {
    if (!ready) return
    const box = chartRef.current?.querySelector<HTMLElement>(
      `[data-flow-box="${chart.selected?.key}"]`,
    )
    box?.focus({ focusVisible: true } as FocusOptions)
    box?.scrollIntoView({ block: 'center', inline: 'center' })
  }, [chart.route, ready])

  const chartArea = (
    <Box
      key="chart"
      ref={chartRef}
      sx={{ flex: 1, minWidth: 0, overflow: 'auto', position: 'relative' }}
    >
      {chart.error && <Typography color="error">{chart.error}</Typography>}
      {layout && (
        <Box
          sx={{
            position: 'relative',
            width: layout.width + PAD * 2,
            height: layout.height + PAD * 2,
            // Centred when the chart is narrower than its area (scrolls from the left edge when wider).
            mx: 'auto',
          }}
        >
          <ChapterLines chart={chart} />
          <Lines chart={chart} />
          {chart.branches.map((branch) => (
            <Diamond key={branch.key} chart={chart} branch={branch} />
          ))}
          {chart.boxes.map((box) => (
            <FlowBoxButton key={box.key} chart={chart} box={box} onLoad={() => void load()} />
          ))}
          <DebugGrid chart={chart} />
        </Box>
      )}
    </Box>
  )
  const panel = <SidePanel key="panel" chart={chart} onLoad={() => void load()} />
  const tabs = <RouteTabs key="tabs" chart={chart} />
  const middle = config.panel.side === 'left' ? [panel, chartArea] : [chartArea, panel]
  const row = config.tabs.side === 'right' ? [...middle, tabs] : [tabs, ...middle]
  return (
    <Box sx={{ display: 'flex', gap: 1.5, width: '86cqw', height: `${config.height * 100}cqh` }}>
      {row}
    </Box>
  )
}

export default defineWindow({ title: 'Flowchart', component: Flowchart, width: '86cqw' })

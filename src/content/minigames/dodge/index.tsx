// Real-time example: dodge falling blocks until time runs out.
// Everything per-frame lives in a ref and is drawn on a canvas, so React never re-renders mid-game.
import { Box, Typography } from '@mui/material'
import { type PointerEvent, useRef } from 'react'
import { defineMinigame, type MinigameProps } from '@/core/define'
import { game } from '@/core/game'
import { useGameLoop } from '@/core/minigame/useGameLoop'

interface Params {
  /** How long to survive. */
  seconds: number
}
interface Result {
  won: boolean
  score: number
}

const READY_SECONDS = 1.2
const PLAYER = { y: 0.9, halfWidth: 0.035, halfHeight: 0.02, speed: 0.9 }

interface Block {
  x: number
  y: number
  halfWidth: number
  speed: number
}

function Dodge({ params, finish }: MinigameProps<Params, Result>) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hudRef = useRef<HTMLDivElement>(null)
  const state = useRef({
    x: 0.5,
    time: -READY_SECONDS,
    blocks: [] as Block[],
    nextBlock: 0,
    score: 0,
    done: false,
    /** Where the pointer/finger is (0..1), or null to use keys/stick. */
    pointerX: null as number | null,
  })

  useGameLoop((dt) => {
    const s = state.current
    const canvas = canvasRef.current
    if (!canvas || s.done) return
    s.time += dt

    // Move: pointer if held/hovering, otherwise keys, d-pad or stick.
    let dx = game.input.move('minigame').x
    if (s.pointerX !== null) dx = Math.max(-1, Math.min(1, (s.pointerX - s.x) * 12))
    s.x = Math.max(PLAYER.halfWidth, Math.min(1 - PLAYER.halfWidth, s.x + dx * PLAYER.speed * dt))

    if (s.time >= 0) {
      // Blocks get faster and more frequent over time.
      s.nextBlock -= dt
      if (s.nextBlock <= 0) {
        s.blocks.push({
          x: Math.random(),
          y: -0.05,
          halfWidth: 0.02 + Math.random() * 0.035,
          speed: 0.35 + s.time * 0.025 + Math.random() * 0.25,
        })
        s.nextBlock = Math.max(0.12, 0.55 - s.time * 0.015)
      }
      for (const block of s.blocks) block.y += block.speed * dt
      const before = s.blocks.length
      s.blocks = s.blocks.filter((b) => b.y < 1.05)
      s.score += before - s.blocks.length

      const hit = s.blocks.some(
        (b) =>
          Math.abs(b.x - s.x) < b.halfWidth + PLAYER.halfWidth &&
          Math.abs(b.y - PLAYER.y) < 0.02 + PLAYER.halfHeight,
      )
      if (hit || s.time >= params.seconds) {
        s.done = true
        game.audio.sfx(hit ? 'sfx/hit' : 'sfx/confirm')
        finish({ won: !hit, score: s.score })
      }
    }

    draw(canvas, s)
    if (hudRef.current) {
      hudRef.current.textContent =
        s.time < 0 ? 'Get ready…' : `${Math.ceil(params.seconds - s.time)} s · ${s.score} dodged`
    }
  })

  const onPointer = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    state.current.pointerX = (e.clientX - rect.left) / rect.width
  }

  return (
    <Box sx={{ position: 'absolute', inset: 0 }}>
      <canvas
        ref={canvasRef}
        onPointerDown={onPointer}
        onPointerMove={onPointer}
        onPointerLeave={() => {
          state.current.pointerX = null
        }}
        style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
      />
      <Typography
        ref={hudRef}
        variant="h6"
        sx={{ position: 'absolute', top: 16, left: 0, right: 0, textAlign: 'center' }}
      />
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ position: 'absolute', bottom: 12, left: 0, right: 0, textAlign: 'center' }}
      >
        Move with ← → / stick / finger · Esc or B to quit
      </Typography>
    </Box>
  )
}

function draw(canvas: HTMLCanvasElement, s: { x: number; blocks: Block[] }) {
  const dpr = window.devicePixelRatio || 1
  const width = Math.round(canvas.clientWidth * dpr)
  const height = Math.round(canvas.clientHeight * dpr)
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.fillStyle = '#0d1117'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#ef5350'
  for (const b of s.blocks) {
    ctx.fillRect(
      (b.x - b.halfWidth) * width,
      (b.y - 0.02) * height,
      b.halfWidth * 2 * width,
      0.04 * height,
    )
  }
  ctx.fillStyle = '#ffd54f'
  ctx.fillRect(
    (s.x - PLAYER.halfWidth) * width,
    (PLAYER.y - PLAYER.halfHeight) * height,
    PLAYER.halfWidth * 2 * width,
    PLAYER.halfHeight * 2 * height,
  )
}

export default defineMinigame({
  component: Dodge,
  // Esc / B quits and counts as a loss.
  quitResult: { won: false, score: 0 },
})

import { Button, Stack, Typography } from '@mui/material'
import { useState } from 'react'
import { defineMinigame, type MinigameProps } from '@/core/define'
import { game } from '@/core/game'

type Hand = 'rock' | 'paper' | 'scissors'
type Result = 'win' | 'lose'

const HANDS: Hand[] = ['rock', 'paper', 'scissors']
const BEATS: Record<Hand, Hand> = { rock: 'scissors', paper: 'rock', scissors: 'paper' }

function RockPaperScissors({ finish }: MinigameProps<void, Result>) {
  const [last, setLast] = useState<string>()

  const play = (hand: Hand) => {
    const theirs = HANDS[Math.floor(Math.random() * HANDS.length)] ?? 'rock'
    if (hand === theirs) {
      game.audio.sfx('sfx/click')
      setLast(`Both picked ${hand}. Draw, go again!`)
      return
    }
    const won = BEATS[hand] === theirs
    game.audio.sfx(won ? 'sfx/confirm' : 'sfx/hit')
    finish(won ? 'win' : 'lose')
  }

  return (
    <Stack spacing={2} sx={{ alignItems: 'center' }}>
      <Typography variant="h5">Rock, paper, scissors</Typography>
      <Stack direction="row" spacing={1}>
        {HANDS.map((hand) => (
          <Button key={hand} variant="contained" onClick={() => play(hand)}>
            {hand}
          </Button>
        ))}
      </Stack>
      {last && <Typography color="text.secondary">{last}</Typography>}
    </Stack>
  )
}

export default defineMinigame({
  component: RockPaperScissors,
  quitResult: 'lose', // Esc / B gives up
})

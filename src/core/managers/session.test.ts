import { describe, expect, it } from 'vitest'
import { save } from '../save/manager'
import { useGameStore } from '../stores/game'
import { useSystemStore } from '../stores/system'
import { session } from './session'

describe('unsaved progress', () => {
  it('counts money and flags as progress, but not time passing', () => {
    useGameStore.setState((s) => {
      s.playtimeMs = s.playtimeMs + 1000
      s.clockMinutes = s.clockMinutes + 1
    })
    expect(save.hasUnsavedChanges()).toBe(false)
    useGameStore.setState((s) => {
      s.money = s.money + 5
    })
    expect(save.hasUnsavedChanges()).toBe(true)
  })

  it('asks before leaving with unsaved progress, and leaves when the player agrees', async () => {
    // Still unsaved from the test above. No map is shown, so saving isn't possible: the
    // question offers only leaving or staying.
    const left = session.leave('title')
    const window = useSystemStore.getState().windows.find((w) => w.id === 'confirm')
    expect(window).toBeDefined()
    const params = window?.params as { answer: (key: string) => void } | undefined
    params?.answer('leave')
    await expect(left).resolves.toBe(true)
  })

  it('stays when the player cancels', async () => {
    useGameStore.setState((s) => {
      s.money = s.money + 1
    })
    const left = session.leave('title')
    const window = useSystemStore.getState().windows.find((w) => w.id === 'confirm')
    const params = window?.params as { answer: (key: string) => void } | undefined
    params?.answer('stay')
    await expect(left).resolves.toBe(false)
  })
})

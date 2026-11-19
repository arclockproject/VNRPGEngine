// A choice made in a route (choice() in src/content/routes): the engine starts this event with the
// options and gets the pick back. Change how it looks (a background, a pose, a sound); keep the name
// and call params.onPick with the picked key.
import { defineEvent } from '@/core/define'
import type { CharacterId } from '@/core/registry'

export default defineEvent<{
  options: Record<string, string>
  ask?: { text?: string; who?: CharacterId }
  onPick: (key: string) => void
}>({
  title: 'Choice',
  run: async ({ choice, say, narrate, params }) => {
    const text = params.ask?.text
    if (text && params.ask?.who) await say(params.ask.who, text)
    else if (text) await narrate(text)
    params.onPick(await choice(params.options))
  },
})

import { defineEvent } from '@/core/define'

export default defineEvent({
  title: "Jack's door",
  run: async ({ narrate }) => {
    await narrate(
      'The door is locked. A note is pinned to it: "Out shopping for furniture. —Jack"',
      {
        italic: true,
      },
    )
  },
})

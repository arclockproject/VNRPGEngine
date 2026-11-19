import { defineEnding } from '@/core/define'

// Reached at the end of Anna's route (src/content/routes/anna: `return ending('anna')`).
// The common route has a choice option that only shows once this ending was reached.
export default defineEnding({
  title: 'Same time tomorrow',
  description: 'You stayed in town, with Anna.',
  hint: 'Stay in town.',
})

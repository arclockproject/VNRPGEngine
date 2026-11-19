// The common route's flowchart boxes: titles, descriptions, pictures, and what each box leaves
// behind for flowchart jumps. Box names autocomplete from index.ts. Everything here is optional.
//  - sets: run INSTEAD of the event for boxes on the way to the one the player loads
//  - before: run just before the event of the box the player loads
//  - shift / column / row / order / align / branchSide / branchShift / lines: fix the chart's layout
//    by hand (all optional). Choice boxes ('?stay_go') and flag diamonds ('!jack_story') take them
//    too. docs/story/routes.html "Fixing the chart by hand"; debug: true in content/config/flowchart.ts shows keys.
// The way's choice() picks are replayed and flags the route branches on with flag() (vn_met_anna) are
// set by themselves on a jump: only write what the graph can't know.
import { defineFlow } from '@/core/define'

export default defineFlow('common', {
  arrival: { description: 'You arrive in town, and someone waves at you.' },
  waved: { description: 'You wave back. Her name is Anna.' },
  the_choice: { description: 'Jack asks you to trust him.' },
  jack_story: { description: 'Jack tells you how he came to town.' },
  jack_lies: { description: 'Jack tells you a story. Probably not a true one.' },
  flashback: { description: 'You remember the pond, and who he is.' },
  anna_greeting: { description: 'Anna is happy to see you again.' },
  leaving: { description: 'The last bus of the day. Stay, or go?' },
})

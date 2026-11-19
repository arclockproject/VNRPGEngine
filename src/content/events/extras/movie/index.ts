// Plays a movie from Extras → Movies (game.extras.playMovie), and the movies a route plays between
// two events (movie('credits') in src/content/routes). The music fades out and the movie plays on
// black. Change it to add a title card or a fade; keep the name, the engine starts it by this id.
import { defineEvent } from '@/core/define'
import type { MovieId } from '@/core/registry'

export default defineEvent<{ movie: MovieId; unlock?: boolean }>({
  title: 'Movie',
  run: async ({ movie, params }) => {
    // Watching it again in Extras never unlocks anything by itself; a route's movie does.
    await movie(params.movie, { unlock: params.unlock ?? false })
  },
})

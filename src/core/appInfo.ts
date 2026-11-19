// The game's name, ids and version (src/content/config/app.ts) with defaults filled in.
import app from '@/content/config/app'
import { resolveApp } from './app'

export const APP = resolveApp(app)

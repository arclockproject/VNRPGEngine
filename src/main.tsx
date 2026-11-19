// Entry point. Stored data (saves, settings, progress) is read first, because the stores read it
// as soon as they are imported; on desktop and Android it comes from files, which is async.
// The media lock worker (built games, web + Android) must control the page before media loads.
import { startMediaLock } from './core/protect/client'
import { loadStorage } from './core/save/storage'

void Promise.all([loadStorage(), startMediaLock()]).then(() => import('./boot'))

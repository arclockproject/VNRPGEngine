// The game's name, ids and version. Set the ids once before the first release. Edit freely.
// Plain values only (no imports): the build scripts and the desktop app read this file too.
import type { AppConfig } from '@/core/app.ts'

export default {
  // Internal id: letters, digits, - and _. Names the save folder on desktop, the browser storage
  // keys and the build files. Changing it after release starts the game without players' saves.
  id: 'INSERTGAMENAMEHERE',
  // Store id, reverse domain style (Android, desktop installers): 'com.mystudio.mygame'.
  appId: 'org.INSERTORGANISATIONHERE.INSERTGAMENAMEHERE',
  // What players see: window title, app name, installer.
  name: 'INSERTGAMENAMEHERE',
  description: 'INSERTGAMENAMEHERE',
  // Shown on the title screen and written into saves.
  version: '0.1.0',
  // A whole number that goes up with every release (Android needs it).
  build: 1,
  // Only save / backup files with these formats load. Default '<id>-save' / '<id>-backup'.
  saveFormat: 'INSERTGAMENAMEHERE-save',
  backupFormat: 'INSERTGAMENAMEHERE-backup',
  // The icons are files in src/content/assets/icon/ (docs: Icons).
  // Behind the Android adaptive icon's front layer (icon.foreground.*), when there's no
  // icon.background.* file:
  iconBackground: '#0d1117',
  // Fills every splash screen, the moment before the game draws its first screen.
  splashBackground: '#000000',
} satisfies AppConfig

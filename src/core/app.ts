// Type for src/content/config/app.ts: the game's name, ids and version. That file is a plain object
// (`satisfies AppConfig`, no runtime imports) because the build scripts and Electron read it too.
// This file must not import content.

export interface AppConfig {
  /**
   * The game's internal id: letters, digits, - and _. It names the save folder on desktop, the
   * browser storage keys and the build files. Set it once before release: changing it later starts
   * the game without the players' saves.
   */
  id: string
  /** The store id, reverse domain style: 'com.mystudio.mygame' (Android and desktop installers). */
  appId: string
  /** The name players see: window title, app name, installer. */
  name: string
  /** '1.2.0'. Shown on the title screen and written into saves. */
  version: string
  /** A whole number that goes up with every release (Android needs it). */
  build: number
  /** One line about the game (desktop installers). Default: the name. */
  description?: string
  /** Written into every save file; only files with this format load. Default '<id>-save'. */
  saveFormat?: string
  /** The same for backup files. Default '<id>-backup'. */
  backupFormat?: string
  /**
   * Behind the Android adaptive icon's front layer (src/content/assets/icon/icon.foreground.*), CSS
   * colour. An icon.background.* file there wins. Default '#000000'.
   */
  iconBackground?: string
  /** Fills every splash screen (the moment before the game draws), CSS colour. Default '#000000'. */
  splashBackground?: string
}

/** The app icons: src/content/assets/icon/ (see scripts/icons.ts). */
export const ICON_DIR = 'assets/icon'
/** The main icon (browser tab, desktop window, installers), path from src/content. */
export const MAIN_ICON = `${ICON_DIR}/icon.png`

/** app.ts with every default filled in. */
export function resolveApp(app: AppConfig): Required<AppConfig> {
  return {
    ...app,
    description: app.description ?? app.name,
    saveFormat: app.saveFormat ?? `${app.id}-save`,
    backupFormat: app.backupFormat ?? `${app.id}-backup`,
    iconBackground: app.iconBackground ?? '#000000',
    splashBackground: app.splashBackground ?? '#000000',
  }
}

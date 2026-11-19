// The game's actions and their keyboard / gamepad / touch bindings.
// Add an action here and it becomes available (typed) in game.input and useAction().
import { defineInput, GamepadButton as GP } from '@/core/input/define'

export default defineInput({
  actions: {
    // padResetInMenus: true = in the pause menu and Settings (menuWindows below) these use their
    // buttons here, whatever the player set, so a controller player can always fix their bindings.
    up: { keys: ['ArrowUp', 'KeyW'], buttons: [GP.DpadUp], stick: 'up', padResetInMenus: true },
    down: {
      keys: ['ArrowDown', 'KeyS'],
      buttons: [GP.DpadDown],
      stick: 'down',
      padResetInMenus: true,
    },
    left: {
      keys: ['ArrowLeft', 'KeyA'],
      buttons: [GP.DpadLeft],
      stick: 'left',
      padResetInMenus: true,
    },
    right: {
      keys: ['ArrowRight', 'KeyD'],
      buttons: [GP.DpadRight],
      stick: 'right',
      padResetInMenus: true,
    },
    confirm: { keys: ['Enter', 'Space', 'KeyF'], buttons: [GP.A], padResetInMenus: true },
    cancel: { keys: ['Escape', 'Backspace'], buttons: [GP.B], padResetInMenus: true },
    // The pause menu: Start on a controller (☰ / Options / +). Escape is also cancel: on the map it
    // opens the menu, in a window it closes the window. padLocked: its controller button can't be
    // changed or taken by another action, so Settings can always be reached.
    menu: { keys: ['Escape'], buttons: [GP.Start], padLocked: true },
    // The bag: the normal game only (vnMode: false = off and not listed in VN-only mode).
    inventory: { keys: ['KeyE'], buttons: [GP.X], vnMode: false },
    // Visual novel, in scenes. LB / RB switch tabs in windows and title screens instead.
    // Hold to skip read lines (a held trigger), go back one line.
    skip: { keys: ['ControlLeft', 'ControlRight'], buttons: [GP.RT] },
    back: { keys: ['PageUp'], buttons: [GP.LB] },
    // Auto-play on / off.
    auto: { keys: ['KeyT'], buttons: [GP.RB] },
    // The log (what was said before). Up opens it too, while no choice is showing.
    log: { keys: ['KeyL'], buttons: [GP.Back] },
    // Hide the text box to see the scene (right-click does it too).
    hide: { keys: ['KeyH'], buttons: [GP.Y] },
    tabPrev: { keys: ['KeyQ'], buttons: [GP.LB] },
    tabNext: { keys: ['KeyR'], buttons: [GP.RB] },
    // Quick save and quick load (the load asks first). On the map and in scenes. No controller
    // button by default: a trigger pressed by accident would overwrite the quick save. Players can
    // give them one in Settings → Controls.
    quickSave: { keys: ['F5'] },
    quickLoad: { keys: ['F9'] },
    // Saves a picture of the screen (settings: src/content/config/screen.ts `screenshot`).
    // Controllers and phones have their own screenshot buttons.
    screenshot: { keys: ['F8'] },
    // Fullscreen on / off (desktop and browser).
    fullscreen: { keys: ['F11'] },
  },
  // How controls feel.
  feel: {
    stick: {
      deadzone: 0.2, // stick movement below this is ignored
      press: 0.5, // past this = that direction is pressed (menus)
      release: 0.3, // ...until it falls back under this
    },
    // Holding a direction on a controller / touch in menus: first repeat after delayMs, then
    // one every rateMs.
    repeat: { delayMs: 400, rateMs: 120 },
    // On-screen joystick (touch), px.
    joystick: { size: 128, knob: 56 },
  },
  // Android's Back button: closes the front window like B, and opens the menu on the map.
  backButton: ['cancel', 'menu'],
  // Where the padResetInMenus actions (moving, confirm, cancel) use their buttons from this file,
  // not the player's own: the pause menu and Settings (and any dialog opened from them).
  menuWindows: ['menu', 'settings'],
  touchButtons: [
    // The ☰ pause menu button is separate: src/content/ui/MenuButton.tsx.
    // In scenes a tap continues, so A/B/Bag only show on the map (they would cover the text).
    { action: 'confirm', label: 'A', layers: ['map'] },
    { action: 'cancel', label: 'B', layers: ['map'] },
    { action: 'inventory', label: 'Bag', layers: ['map'] },
  ],
})

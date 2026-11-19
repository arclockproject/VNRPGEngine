---
name: pixijs-blend-modes
description: "PixiJS v8 blend modes: container.blendMode, standard (add, multiply, screen, erase) and advanced (overlay, color-burn) modes, batching order. Use for blendMode, glow, shadows, overlay."
license: MIT
---

Set `container.blendMode`. Standard modes are cheap GPU blends. Advanced modes are filter-based and cost more.

## Standard modes

Built in, no import needed: `normal`, `add`, `multiply`, `screen`, `erase`, `none`, `inherit` (the default), `min` and `max` (WebGL2 only).

```ts
glow.blendMode = "add";
shadow.blendMode = "multiply";
```

## Advanced modes

Import the extension once, and init with `useBackBuffer: true` on WebGL, or the mode silently falls back:

```ts
import "pixi.js/advanced-blend-modes";
await app.init({ useBackBuffer: true });
overlay.blendMode = "color-burn";
```

Modes: `color-burn`, `color-dodge`, `darken`, `difference`, `divide`, `exclusion`, `hard-light`, `hard-mix`, `lighten`, `linear-burn`, `linear-dodge`, `linear-light`, `luminosity`, `negation`, `overlay`, `pin-light`, `saturation`, `soft-light`, `subtract`, `vivid-light`, `color`.

## Batching

A change of blend mode between neighbours breaks the render batch. Group siblings with the same mode:

```ts
scene.addChild(screen1, screen2, normal1, normal2); // 2 draw calls
// screen, normal, screen, normal would be 4
```

## Mistakes to avoid

- **Advanced mode without the import:** it falls back to normal silently. Add `import "pixi.js/advanced-blend-modes"`.
- **Advanced mode without `useBackBuffer`:** WebGL falls back silently. Pass `useBackBuffer: true` to `app.init`.
- **v7 enum:** `BLEND_MODES.ADD` is undefined in v8 (it's only a type). Use the string `"add"`.
- **Clipped on high-DPI screens:** advanced modes render at resolution 1 by default. Set `Filter.defaultOptions.resolution = "inherit"` before creating those objects, where fidelity matters (it costs memory).

Related skills: `pixijs-filters`, `pixijs-performance`, `pixijs-color`.

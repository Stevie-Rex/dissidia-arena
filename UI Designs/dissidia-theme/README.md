# Dissidia Arena theme package v1.0.0

The Rift and Classic interfaces for Dissidia Arena, as files an agent can drop into the project.
Read `docs/theme-spec.md` (the tech spec, exported from the Docs artifact) for behaviour; this folder holds the values.

## Files

| File | Use |
| --- | --- |
| `tokens.json` | Every world theme, window theme, menu font, size and reward goal as data. The source of truth. |
| `css/fonts.css` | Google Fonts import for all 8 families. Link it before the theme CSS. |
| `css/dissidia-theme.css` | Custom properties for every theme, plus `.da-window`, `.da-command`, `.da-gauge`, `.da-glyph` and the `.da-rift-*` hero classes. |
| `js/appearance.js` | `window.DissidiaAppearance`: apply, save, switch interface, preview mode, custom window colour, reward progress. |
| `python/rewards.py` | Reward catalogue, `validate_changes()`, `grant_unlocks()` for Flask. |
| `assets/` | `glove.svg` cursor, `cosmos.svg` and `chaos.svg` side glyphs (used as CSS masks), `crystal.svg` hero crystal. |

## Wiring it up

```html
<html data-interface="rift" data-world="dissidia" data-window="classic" data-cursor="glove">
<head>
  <link rel="stylesheet" href="/static/dissidia-theme/css/fonts.css">
  <link rel="stylesheet" href="/static/dissidia-theme/css/dissidia-theme.css">
  <script src="/static/dissidia-theme/js/appearance.js" defer></script>
</head>
```

- Render the player's saved preferences as those attributes on the server, so the first paint is correct.
- Omit `data-menu-font` (or use `auto`) to get the window theme's own font.
- Components must use `var(--rift-…)` or `var(--win-…)` only, never hex values.
- Classic text sizes: `var(--menu-title)`, `--menu-command`, `--menu-big`, `--menu-label`, `--menu-body`, `--menu-small`.
- Mark side-specific elements with `data-side="cosmos"` or `data-side="chaos"`; they get `--side` as their colour. Always show the glyph or the name too.

## Rewards

| Key | Unlocks | Ranked wins |
| --- | --- | --- |
| `classic_interface` | Classic interface | 25 |
| `font_8bit` | 8-bit menu font | 50 |
| `window_custom` | Custom window theme and RGB sliders | 100 |

The server enforces these (`validate_changes` returns 403 for a locked value). The browser only shows the locks.

## Changing values

`css/dissidia-theme.css` and `tokens.json` hold the same values. If you change a colour, change it in both.
Every text and background pair passes WCAG 4.5:1; check contrast again if you change a colour.

Themes are inspired by the Final Fantasy series. No official logos, art or fonts are included. Dissidia Arena is a fan project.

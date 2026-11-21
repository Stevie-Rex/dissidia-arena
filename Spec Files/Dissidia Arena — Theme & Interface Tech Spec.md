# Dissidia Arena — Theme & Interface Tech Spec

Nov 21, 2026 · @Steve O'Shea

## Overview

Dissidia Arena ships with two interfaces: **Rift** is the default for every player, and **Classic** (pixel menu windows) unlocks as a reward at 10 ranked wins. After that, a new Classic window skin unlocks every 5 ranked wins, then the 8-bit font at 50 and a custom window colour at 60. Players switch between them with an Interface control that appears on every page.

This spec tells an implementing agent (Claude Code) exactly what to build. The theme package `dissidia-theme/` holds the design tokens, CSS, fonts and assets, and is the source of truth for every colour and size. Where this spec and the package disagree, the package wins for values and this spec wins for behaviour.

**In scope**

- The Rift interface and its 6 world themes
- The Classic interface with 8 window themes, 4 menu fonts, a glove or arrow cursor and a custom window colour
- The Interface switcher, the lock panel and Classic preview mode
- A ladder of 10 reward unlocks from 10 to 60 ranked wins, checked on the server
- Saving each player's appearance choices to the database
- The victory screen that announces an unlocked reward

**Out of scope**

- Matchmaking, combat rules and the battle engine
- Sound and music
- New rewards beyond the ten listed here

**How to use this with Claude Code**: export this doc as Markdown, put it in the repo as `docs/theme-spec.md`, and copy the `dissidia-theme/` folder into the project. Then ask Claude Code to follow the build order in the last section. The design canvas with every screen is at [Dissidia Arena — Cosmos vs Chaos concepts](https://claude.ai/artifact/CA79rRUkA48PgBKa68qXbu) (Final page).

## Concepts

Appearance is made of five independent layers, each set by its own `data-` attribute on `<html>`. Rift uses one layer and Classic uses four, so switching interface never loses the other interface's choices.

| Layer | Attribute | Applies to | Values | Default | Locked by |
| --- | --- | --- | --- | --- | --- |
| Interface | `data-interface` | Whole site layout | `rift`, `classic` | `rift` | `classic` needs 10 ranked wins |
| World theme | `data-world` | Rift only | `dissidia`, `crystal`, `magitek`, `mako`, `gaia`, `ivalice` | `dissidia` | Never |
| Window theme | `data-window` | Classic only | `classic`, `crystal`, `magitek`, `midgar`, `garden`, `gaia`, `spira`, `ivalice`, `custom` | `classic` | `classic` comes with the Classic interface (10 wins). The other presets unlock one every 5 wins, from `crystal` at 15 to `ivalice` at 45. `custom` needs 60. |
| Menu font | `data-menu-font` | Classic only | `auto`, `bit16`, `bit8`, `story`, `modern` | `auto` (the window theme's own font) | `bit8` needs 50 ranked wins |
| Cursor | `data-cursor` | Classic only | `glove`, `arrow` | `glove` | Never |

Two more attributes are set by the app, not chosen by the player: `data-preview="classic"` while a locked player previews Classic, and `data-side="cosmos"` or `data-side="chaos"` on any element that belongs to one side.

**Cosmos and Chaos.** Every match has a Cosmos side and a Chaos side, with one player or a team of three on each. Each side has a colour token and a glyph: a sun shape for Cosmos and a cracked diamond for Chaos (both in `assets/`). A side is always shown with its glyph or name as well as its colour, so colour-blind players can tell them apart.

**Rift and Classic are different layouts, not only different colours.** Rift is an editorial page with a split hero. Classic is a grid of menu windows with a command list. Build them as two layout templates that render the same data (see Front-end state).

## Design tokens

All colours and type settings are CSS custom properties defined in `dissidia-theme/css/dissidia-theme.css`, keyed off the `data-` attributes above. Components use only `var(--…)` and never a hex value, so a new theme is one new CSS block. The same values are in `tokens.json` for any code that needs them, such as the Python side or a Tailwind config.

**Package contents**

| File | What it holds |
| --- | --- |
| `README.md` | Short instructions for the implementing agent |
| `tokens.json` | Every theme, font and reward goal as data |
| `css/fonts.css` | The Google Fonts import for all 8 families |
| `css/dissidia-theme.css` | Custom properties for every world and window theme, the menu font scale, and the shared `.da-window` and `.da-glyph` classes |
| `js/appearance.js` | `applyAppearance()`, preview mode, the custom colour formula and reward goals |
| `python/rewards.py` | Reward catalogue and unlock checks for Flask |
| `assets/*.svg` | Glove cursor, Cosmos glyph, Chaos glyph, crystal mark |

**Rift tokens** (one set per world theme, prefixed `--rift-`)

| Token | Used for |
| --- | --- |
| `page-bg`, `card-bg`, `ink`, `muted`, `line` | Page background, cards, body text, secondary text, rules |
| `gold`, `gold-text` | Ornaments and rules; `gold-text` is the darker shade that passes 4.5:1 for small text |
| `cosmos-bg`, `cosmos-ink`, `cosmos-muted`, `cosmos-accent`, `cosmos-btn-ink`, `cosmos-line` | The Cosmos half of the hero and its button |
| `chaos-bg`, `chaos-ink`, `chaos-muted`, `chaos-accent`, `chaos-btn-ink`, `chaos-line` | The Chaos half, the chronicle band and its button |
| `meter-cosmos`, `meter-chaos` | The Cycle of War gauge and reward progress bars |

**Classic tokens** (one set per window theme, prefixed `--win-`)

| Token | Used for |
| --- | --- |
| `page-bg` | Background behind the windows |
| `top`, `bot`, `angle` | The window gradient: `linear-gradient(var(--win-angle), var(--win-top), var(--win-bot))`, exposed as `--win-bg` |
| `border`, `bw`, `radius`, `bevel` | Outer border colour and width, corner radius, inner bevel line |
| `ink`, `muted`, `shadow` | Text, secondary text, text shadow |
| `cursor`, `sel`, `inner` | Cursor colour, selected-row tint, inner card borders |
| `cosmos`, `chaos`, `track`, `hp` | Side colours, bar tracks, HP fill |

Window themes differ in more than colour, which is what makes each one feel like its game:

| Window theme | After | Radius | Border | Gradient | Default font |
| --- | --- | --- | --- | --- | --- |
| Classic | FF I to VI | 8px | 2px | top to bottom | 16-bit |
| Crystal | FF IV | 8px | 2px | top to bottom | 16-bit |
| Magitek | FF VI | 8px | 2px | top to bottom | 16-bit |
| Midgar | FF VII | 4px | 2px | diagonal, 135deg | Modern |
| Garden | FF VIII | 2px | 1px | top to bottom | Modern |
| Gaia (grey) | FF IX | 14px | 3px | top to bottom | Storybook |
| Spira | FF X | 12px | 1px | top to bottom | Modern |
| Ivalice | FF XII | 6px | 2px | top to bottom, light | Storybook |
| Custom | Player's RGB | 8px | 2px | from the sliders | 16-bit |

**Fonts**

| Role | Family (Google Fonts) | Weight | Scale | Line height |
| --- | --- | --- | --- | --- |
| Rift brand and numerals | Cinzel Decorative | 700 | — | — |
| Rift headings and labels | Cinzel | 600 to 700 | — | 1.05 to 1.1 |
| Rift lore lines | Cormorant Garamond italic | 500 | — | 1.4 |
| Rift body | Inter | 400 to 600 | — | 1.55 to 1.6 |
| Classic `bit16` | DotGothic16 | 400 | 1.0 | 1.45 |
| Classic `bit8` | Press Start 2P | 400 | 0.6 | 1.9 |
| Classic `story` | Marcellus SC | 400 | 0.95 | 1.45 |
| Classic `modern` | Rajdhani | 700 | 1.08 | 1.35 |

Classic text sizes are a base size times the font's scale, with a floor of 12px: `font-size: max(12px, calc(<base> * var(--menu-scale)))`. The bases are title 26, command 22, big 28, label 17, body 16 and small 14 (all px). The 8-bit font is much wider, which is why its scale is 0.6.

The real Final Fantasy menu fonts are not licensed for reuse. These free fonts are close in spirit and safe for a fan project.

## Rift interface

Rift is a light editorial page split into a Cosmos side and a Chaos side, with gold ornaments, Roman numerals and lore lines. Build the home page in this order, top to bottom. The "Final — Home" artboard on the canvas is the reference.

| Component | What it does | Key rules |
| --- | --- | --- |
| Header | Crystal mark, "Dissidia Arena" in Cinzel Decorative, nav (Play, Fighters, Rankings, Rewards) with ◆ separators, Interface switcher | Nav links are at least 44px tall. The switcher is two buttons in a bordered group with `aria-pressed`. A lock icon shows on Classic while it is locked. |
| Lock panel | Opens under the header when a locked player taps Classic | Shows wins so far against 10 as a progress bar, plus Preview Classic and Not now buttons. The Classic button has `aria-expanded`. |
| Fracture hero | Cosmos half and Chaos half meeting along a jagged crystal crack | See below |
| Worlds picker | Six crystal-shaped swatches with the game's Roman numeral | Each is a `<button aria-pressed>`. Choosing one sets `data-world` and saves it. |
| Trials | Four mode cards numbered I to IV (Duel, Clash, Ranked, Custom) with gold corner brackets | Whole card is one link |
| Cycle of War | Season gauge split into 20 segments, like an ATB bar | `role="img"` with an `aria-label` that states both percentages |
| Rewards | One card per reward on the ladder (10 in all), each with a progress bar and status | Status reads "7 / 10" or "Unlocked" |
| Chronicle | Dark band with a lore quote in Cormorant Garamond italic | Uses Chaos tokens |
| Footer | Fan project note and the current interface and world | — |

**Fracture hero.** The section has the Cosmos background. An absolutely positioned layer with the Chaos background is clipped to the jagged shape with `clip-path`. On top sit the two content halves, each 50% wide, with text kept at least 96px from the crack. The clip paths are in `dissidia-theme.css` as `.da-rift-chaos`:

- Desktop: `polygon(55% 0,100% 0,100% 100%,45% 100%,48% 84%,44% 74%,50% 60%,46% 47%,53% 34%,50% 22%,56% 11%)`
- At 760px wide or less, the halves stack and the crack runs across instead: `polygon(0 51%,14% 47%,27% 53%,42% 46%,58% 52%,73% 45%,88% 51%,100% 47%,100% 100%,0 100%)`

Decorations are inline SVG with `aria-hidden="true"`: gold constellation lines behind the Cosmos text, red fracture lines behind the Chaos text, and a two-tone crystal with a VS badge centred on the crack. A banner reading "The XIII Cycle of War" sits at the top centre.

**Accessibility.** Every text and background pair in the tokens passes 4.5:1. Use `gold-text`, never `gold`, for small text. Make the Cosmos heading the page's only `h1` and the Chaos heading an `h2` with the same style, inside one `section` labelled "Choose your side".

## Classic interface

Classic draws every part of the page as an old-school RPG menu window, with a command list on the left, a glove cursor and a help bar along the bottom. The "Final — Home" artboard (with Classic chosen) and "C · Command — Battle HUD" are the references.

**Window component (`.da-window`).** Every panel uses this one class:

```css
.da-window {
  background: var(--win-bg);
  border: var(--win-bw) solid var(--win-border);
  border-radius: var(--win-radius);
  box-shadow: 0 0 0 1px rgba(0,0,0,.55), inset 0 0 0 1px var(--win-bevel);
  color: var(--win-ink);
  text-shadow: var(--win-shadow);
  font-family: var(--menu-family);
  line-height: var(--menu-lh);
}
```

**Home layout.** A header window (title, player name, side, wins), then a row with the command window on the left (`flex: 1 1 220px`) and a grid of content windows on the right (`flex: 999 1 640px`): Battle, Cycle of War and Config. A help bar window spans the bottom. Below 760px the command window stacks above the content.

**Command menu.**

- A `<nav>` holding a list of buttons: Battle, Fighters, Rankings, Rewards, Config. Each is at least 48px tall.
- Each row has a 28px cursor slot. The current row shows the cursor (glove SVG or a ▶ in `--win-cursor`), has `aria-current="page"` and the `--win-sel` tint.
- Keyboard: Up and Down arrows move focus within the list (roving `tabindex`), Enter or Space selects, and Tab leaves the list.
- The help bar (`aria-live="polite"`) shows a one-line description of the focused command.

**Config window.**

| Control | Behaviour |
| --- | --- |
| Interface | Rift or Classic. Choosing Rift switches straight back. |
| Window theme | List of 9 rows, each with a mini swatch of that window. Choosing one sets `data-window` and saves it. Each preset other than Classic, and Custom, shows a lock and "Unlocks at N wins" (15 to 45 for the presets, 60 for Custom) until earned. |
| Menu font | 2 by 2 grid of buttons, each label shown in its own font. A locked font is `disabled` with "Unlocks at 50 wins" and 55% opacity. `auto` uses the window theme's default font. |
| Cursor | Glove or Arrow toggle |
| Window colour | Three range inputs, R, G and B, each 0 to 31. Only shown once Custom is unlocked. Moving one switches the window theme to Custom. |

**Custom window colour.** The sliders follow the 0 to 31 scale of the old Config screens. Each channel is multiplied by 3, so the base colour is at most rgb(93, 93, 93) and white text always passes 4.5:1. Then `--win-top` is the base × 1.2, `--win-bot` is the base × 0.45 and `--win-track` is the base × 0.25. `customWindow(r, g, b)` in `appearance.js` does this. The default is R 6, G 10, B 26.

**Preview banner.** While a locked player previews Classic, a window with a `--win-cursor` border sits above the header. It reads "PREVIEW: Win N more ranked battles to keep the Classic interface.", where N counts down to 10 wins. and has a Back to Rift button. It has `role="status"`.

**Battle HUD.** It uses the same windows, fonts and cursor: a score bar, the arena view, a party window for each side with HP bars, and a command window (Attack, Skill, Guard, Burst).

## Unlocks and rewards

Rewards are earned by **ranked wins** and are permanent once earned. The server decides what is unlocked; the browser only shows locks and must never be trusted to enforce them.

Classic unlocks at 10 ranked wins, then a new window skin every 5 wins. Wins count across both games.

| Reward key | Unlocks | Ranked wins needed | Where it shows |
| --- | --- | --- | --- |
| `classic_interface` | The Classic interface and the Classic window theme (`interface=classic`, `window_theme=classic`) | 10 | Interface switcher, lock panel, Rewards section |
| `window_crystal` | The Crystal window theme | 15 | Classic Config, Window theme |
| `window_magitek` | The Magitek window theme | 20 | Classic Config, Window theme |
| `window_midgar` | The Midgar window theme | 25 | Classic Config, Window theme |
| `window_garden` | The Garden window theme | 30 | Classic Config, Window theme |
| `window_gaia` | The Gaia window theme | 35 | Classic Config, Window theme |
| `window_spira` | The Spira window theme | 40 | Classic Config, Window theme |
| `window_ivalice` | The Ivalice window theme | 45 | Classic Config, Window theme |
| `font_8bit` | The 8-bit menu font (`menu_font=bit8`) | 50 | Classic Config, Menu font |
| `window_custom` | The Custom window theme and the RGB sliders (`window_theme=custom`, `window_rgb`) | 60 | Classic Config, Window theme and Window colour |

Rift worlds, the other menu fonts and the cursor are free.

The goals live in one place: the backend's reward catalogue (ported from `REWARDS` in `python/rewards.py`), mirrored in the `rewards` array of `tokens.json` for the front end. Change a number there and nothing else.

**Rules**

1. A ranked win is a finished ranked match where the player's side won, counted across both games. Duel and Clash both count. Custom rooms and practice do not.
2. When the server records a match result, it recalculates the winner's ranked win count. It then inserts a `user_unlocks` row for each reward whose goal is now met and that the player does not already hold.
3. The match result response lists any rewards unlocked by that match in `newly_unlocked`. The front end uses this to show the victory reward screen.
4. Unlocks are never removed, even if rules change later or a match is voided.
5. Every write to appearance settings is checked. Saving any value listed in the table above (`interface=classic`, a locked `window_theme`, `menu_font=bit8` or `window_rgb`) without the reward that unlocks it returns 403.
6. Players who already have the wins when this ships get their unlocks from a one-off backfill (see Build order).

**Preview mode** lets a locked player try Classic. It is client-only: it sets `data-interface="classic"` and `data-preview="classic"`, stores `da-preview` in `sessionStorage`, and saves nothing to the server. It ends when the player taps Back to Rift or closes the tab. During preview only the Classic window theme is available: the locked window skins, the 8-bit font and Custom stay locked.

**Victory reward screen.** When `newly_unlocked` is not empty, the match result page shows a reward card above the scoreboard. It holds the reward name, a full progress bar (10 / 10 for Classic, or the goal of whichever reward was earned), a "Received Classic Interface!" message in a Classic window, and two actions: Equip Classic now (saves `interface=classic`) and Keep Rift for now. Below it, a list shows the next rewards with progress. The "Final — Victory" artboard is the reference.

## Data model and API

This needs two new MariaDB tables and one new column. It assumes an existing `users` table with an integer `id` and an existing `matches` table that records ranked results. Adjust the names to match the project.

```sql
ALTER TABLE users
  ADD COLUMN ranked_wins INT UNSIGNED NOT NULL DEFAULT 0;

CREATE TABLE user_preferences (
  user_id       INT          NOT NULL PRIMARY KEY,
  interface     ENUM('rift','classic') NOT NULL DEFAULT 'rift',
  world         VARCHAR(20)  NOT NULL DEFAULT 'dissidia',
  window_theme  VARCHAR(20)  NOT NULL DEFAULT 'classic',
  menu_font     VARCHAR(10)  NOT NULL DEFAULT 'auto',
  cursor_style  ENUM('glove','arrow') NOT NULL DEFAULT 'glove',
  window_r      TINYINT UNSIGNED NOT NULL DEFAULT 6,
  window_g      TINYINT UNSIGNED NOT NULL DEFAULT 10,
  window_b      TINYINT UNSIGNED NOT NULL DEFAULT 26,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_prefs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE user_unlocks (
  user_id      INT         NOT NULL,
  reward_key   VARCHAR(40) NOT NULL,
  unlocked_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, reward_key),
  CONSTRAINT fk_unlocks_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

`ranked_wins` is a cached count, updated in the same transaction that records a ranked result. A player with no `user_preferences` row gets the defaults; create the row on first save.

**Endpoints** (all need a logged-in user)

| Method and path | Purpose | Success | Errors |
| --- | --- | --- | --- |
| `GET /api/me/appearance` | Current choices, unlocks, wins and reward progress | 200 | 401 |
| `PATCH /api/me/appearance` | Save one or more choices | 200 with the full appearance | 400 unknown value, 403 locked, 401 |
| `GET /api/rewards` | The reward catalogue (keys, names, goals) | 200 | — |
| `POST /api/matches/<id>/result` (existing) | Record a result; now also grants unlocks | 200 with `newly_unlocked` added | as before |

`GET /api/me/appearance` returns:

```json
{
  "preferences": {
    "interface": "rift", "world": "dissidia", "window_theme": "classic",
    "menu_font": "auto", "cursor": "glove", "window_rgb": [6, 10, 26]
  },
  "ranked_wins": 18,
  "unlocks": ["classic_interface", "window_crystal"],
  "rewards": [
    {"key": "classic_interface", "goal": 10, "unlocked": true, "remaining": 0},
    {"key": "window_crystal", "goal": 15, "unlocked": true, "remaining": 0},
    {"key": "window_magitek", "goal": 20, "unlocked": false, "remaining": 2},
    {"key": "window_midgar", "goal": 25, "unlocked": false, "remaining": 7},
    {"key": "window_garden", "goal": 30, "unlocked": false, "remaining": 12},
    {"key": "window_gaia", "goal": 35, "unlocked": false, "remaining": 17},
    {"key": "window_spira", "goal": 40, "unlocked": false, "remaining": 22},
    {"key": "window_ivalice", "goal": 45, "unlocked": false, "remaining": 27},
    {"key": "font_8bit", "goal": 50, "unlocked": false, "remaining": 32},
    {"key": "window_custom", "goal": 60, "unlocked": false, "remaining": 42}
  ]
}
```

`PATCH` takes any subset of `preferences`. It checks that every value is in the allowed list from `tokens.json` (400 if not) and that any locked value is unlocked (403 if not). Each RGB channel must be an integer from 0 to 31. A 403 body names the reward so the front end can open the lock panel:

```json
{"error": "locked", "reward": "window_magitek", "goal": 20, "remaining": 2}
```

`rewards.py` gives the Flask side three helpers: `required_reward(field, value)` returns the reward key a value needs (or `None`), `rewards_for_wins(wins)` returns the keys earned at that count, and `grant_unlocks(db, user_id, wins)` inserts the missing rows and returns the new keys. Use `INSERT IGNORE` so two results landing at once cannot double-grant.

## Front-end state and switching

The server renders the player's saved appearance straight onto `<html>`, so the first paint is already in the right theme. JavaScript only handles changes after that.

**On page load**

1. Flask loads the player's preferences (or the defaults) and passes them to the template.
2. The base template writes them as attributes: `<html data-interface="{{ p.interface }}" data-world="{{ p.world }}" data-window="{{ p.window_theme }}" data-menu-font="{{ p.menu_font }}" data-cursor="{{ p.cursor }}">`. For Custom, it also writes the `--win-top`, `--win-bot` and `--win-track` values as an inline style.
3. The page picks its layout from the interface: `{% extends 'layouts/' ~ p.interface ~ '.html' %}`, giving `layouts/rift.html` or `layouts/classic.html`. Both render the same blocks (header, nav, main, footer) from the same view data.
4. A small inline script in `<head>` checks `sessionStorage` for `da-preview`. If it is set and the player is still locked, it sets `data-interface="classic"` and `data-preview="classic"` before paint.

**Changing a setting**

- Worlds, window themes, fonts, cursor and RGB are colour-only changes. `applyAppearance()` updates the attribute or custom property at once, then sends `PATCH /api/me/appearance` in the background. If the server returns 403, it reverts the change and opens the lock panel.
- Switching interface changes the layout, so it sends the `PATCH` first and reloads the page when it succeeds. This keeps the two layouts as plain server templates.
- Starting a preview sets `da-preview` and reloads. Back to Rift clears it and reloads.

**If the front end is React instead of Jinja**, keep the same contract. Put the appearance in a context provider fed by `GET /api/me/appearance`, set the same `data-` attributes on `document.documentElement`, and switch between `<RiftLayout>` and `<ClassicLayout>` instead of reloading. Cache the last appearance in `localStorage` and apply it before the first render to avoid a flash.

The flow below shows what happens when a player taps Classic.

&#91;embedded content: Interface switch flow · 1 decision, preview path\]

Only the server's unlock check decides whether Classic is saved. Preview always returns to Rift without saving anything.

## Acceptance criteria and tests

The work is done when every item below passes. Unit tests use pytest against a test MariaDB database, and the browser checks use Playwright.

**Behaviour**

- [ ] A new player sees Rift with the Dissidia world, and Classic shows a lock.
- [ ] Tapping a locked Classic opens the lock panel with the right number of wins remaining.
- [ ] Preview shows Classic with the preview banner, saves nothing, and ends with Back to Rift or a new tab.
- [ ] A player with 10 or more ranked wins can switch to Classic, and the choice persists across log-out, log-in and devices.
- [ ] Each world and window theme choice persists in the same way.
- [ ] Each preset window theme other than Classic stays locked until its goal (Crystal 15, Magitek 20, Midgar 25, Garden 30, Gaia 35, Spira 40, Ivalice 45). The 8-bit font stays disabled until 50 wins. Custom and the RGB sliders stay locked until 60 wins.
- [ ] Choosing Rift from Classic's Config switches back and keeps the Classic choices for next time.

**Server**

- [ ] `PATCH` with a locked value returns 403 with the reward key and the wins remaining, and changes nothing.
- [ ] `PATCH` with an unknown value or an RGB channel outside 0 to 31 returns 400.
- [ ] The result of a 10th ranked win returns `newly_unlocked: ["classic_interface"]` exactly once, and a 15th returns `["window_crystal"]`. Replaying the same result grants nothing new.
- [ ] Custom rooms and practice matches do not change `ranked_wins`.
- [ ] The backfill gives existing players every unlock their wins have already earned.

**Look and accessibility**

- [ ] Every page renders correctly in all 6 worlds and all 9 window themes, with no hard-coded colours left in components.
- [ ] There is no flash of the wrong theme on load, including during preview.
- [ ] At 760px wide or less, the hero crack runs across, the halves stack and nothing scrolls sideways.
- [ ] Every control is reachable by keyboard, has a visible focus style and reports its state (`aria-pressed`, `aria-current`, `disabled`).
- [ ] The Classic command menu moves with the Up and Down arrows.
- [ ] An axe scan reports no colour-contrast failures in any theme.
- [ ] Cosmos and Chaos are always shown with a glyph or name, never by colour alone.

## Build order and open questions

Build in this order. Each step can be checked before the next one starts, so the work suits one agent task per step.

1. **Theme package.** Copy `dissidia-theme/` into the static folder. Link `fonts.css` and `dissidia-theme.css` from the base template, and load `appearance.js` with `defer`.
2. **Database.** Add a migration with the SQL above. Add a one-off backfill script that recalculates `ranked_wins` from `matches` and calls `grant_unlocks` for every player.
3. **Rewards logic.** Add `rewards.py` and call `grant_unlocks` from the match result handler. Write the server tests for unlocking first.
4. **Appearance API.** Add `GET` and `PATCH /api/me/appearance` and `GET /api/rewards`, with the validation tests.
5. **Rift layout.** Build `layouts/rift.html` and its components: header, switcher, lock panel, fracture hero, worlds, trials, Cycle of War, rewards, chronicle and footer.
6. **Classic layout.** Build `layouts/classic.html`: the `.da-window` component, command menu with keyboard support, help bar and Config window.
7. **Switching and preview.** Wire the switcher, the lock panel, the preview banner and the no-flash script to `appearance.js`.
8. **Victory reward screen.** Add the reward card and the next-rewards list to the match result page.
9. **Check.** Run every acceptance test, then the axe and mobile checks in all themes.

**Open questions**

- Is the front end Jinja templates or React? This spec defaults to Jinja and gives the React variant in Front-end state.
- Should a forfeit by the other side count as a ranked win?
- Should the Battle HUD follow the player's interface, or always use Classic windows?
- Should more rewards follow later, for example unlocking individual worlds, or a title for 100 wins?
- Should switching interface play a sound, such as a menu cursor blip, once audio exists?

**Fan project note.** The themes are inspired by the Final Fantasy series but use no official logos, character art or fonts. Keep the "a fan project" line in the footer.

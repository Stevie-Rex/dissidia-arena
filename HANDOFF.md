# Handoff: Dissidia Arena

_Last updated 2026-11-21. Branch: `feat/queue-matchmaking`._

**The website's new look is built** (Rift and Classic interfaces, with the reward ladder).
The bot is finished for now. Read this file, then the spec, then `backend/README.md` for setup.
The code is the source of truth. This file covers what the code doesn't say.

## What this project is

A hub for the small Dissidia competitive community (at most ~100 players). Players queue for ranked 1v1s from the
**website or a Discord bot**, get matched, play, report results and (later) climb a ladder.

- **Games:** Dissidia 012 (PPSSPP emulator) and Dissidia NT (PS4 and PC, separate queues, no cross-play).
- **Focus right now: the 012 website.** The owner wants the site fully working and looking right before more bot work.
- Every design choice should favour *getting people into games*. Splitting a tiny queue leaves it empty.

### Decisions the owner has made (don't re-litigate)

| Topic | Decision |
|---|---|
| Ranked format | Bo3 for both games |
| NT platforms | No cross-play: PS4 and PC are separate queues |
| Seasons | Separate per game (not built yet) |
| Bot | One bot, added to each game's server, each server bound to one game. **Leave it as it is for now.** |
| Interfaces | Rift is the default; Classic unlocks at 10 ranked wins, then a new window skin every 5 wins (15 to 45), the 8-bit font at 50 and a custom window colour at 60. Wins count across both games (see the spec) |

## The design work

### Where the design lives

| What | Where | Notes |
|---|---|---|
| Tech spec | `Spec Files/Dissidia Arena — Theme & Interface Tech Spec.md` | Behaviour, layouts, data model, API, acceptance criteria, build order. |
| Theme package | `UI Designs/dissidia-theme/` | `tokens.json`, `css/dissidia-theme.css`, `css/fonts.css`, `js/appearance.js`, `python/rewards.py`, `assets/*.svg`. |
| Design canvas | Linked from the spec ("Cosmos vs Chaos concepts", Final page) | Artboards: Final — Home, Final — Victory, C · Command — Battle HUD |

The spec's own rule: **the package wins for values, the spec wins for behaviour.** The spec suggests moving them to
`docs/theme-spec.md` and copying the package into the project. Neither has been done: both folders are committed as delivered, but not
wired into `frontend/` yet (the folder names contain spaces and an em dash, so quote the paths).

### Where the spec doesn't match this codebase

The spec was written without seeing the code. Settle these before building, and ask the owner about anything
marked **(ask)**.

1. **It's React, not Jinja.** The spec defaults to Flask templates. This site is a React 19 + Vite + Tailwind 4 single
   page app (`frontend/`), so use the spec's React variant: an appearance context fed by `GET /api/me/appearance`,
   `data-` attributes set on `document.documentElement`, `<RiftLayout>` / `<ClassicLayout>` switched without a reload,
   and the last appearance cached in `localStorage` and applied before first render (an inline script in
   `frontend/index.html`) so the wrong theme never flashes. That answers the spec's first open question.
2. **`appearance.js` is a browser global** (`window.DissidiaAppearance`, uses `fetch` and reloads). Port the parts you
   need (`customWindow`, `requiredReward`, preview helpers, `rewardProgress`) to a TypeScript module, and drop the
   reload-based interface switch. Import the CSS through Vite. Its asset URLs are relative (`../assets/*.svg`),
   so keep the `css/` and `assets/` folders side by side, for example under `frontend/src/theme/`.
3. **The current look is a dark palette in Tailwind.** `frontend/src/index.css` defines a "Nocturne" dark theme as
   Tailwind `@theme` colours (`ink`, `panel`, `card`, `gold`, `crystal`, `chaos`…), used about 217 times across 15
   files. Rift is a light editorial look. A low-risk first step is to point those Tailwind colours at the theme's
   custom properties (`@theme inline { --color-panel: var(--rift-card-bg); … }`), so existing pages pick up the
   theme while the layouts are rebuilt. The spec wants no hex values in components, and the `.tsx` files have
   none today, so keep it that way.
4. **There's no `POST /api/matches/<id>/result`.** Results come from `POST /api/matches/<id>/games` (report each game)
   and `POST /api/matches/<id>/confirm`. A match becomes `completed` in `confirm()` in `backend/app/matchmaking.py`,
   and that's where `ranked_wins` should go up and unlocks be granted, with `newly_unlocked` added to that response.
   A ranked win = a `completed` match where `Match.winner_id` is the player. `disputed`, `cancelled` and `abandoned`
   don't count. There are no "custom rooms" or "practice" matches, and voiding doesn't exist yet.
5. **`rewards.py` uses a raw DB cursor and `INSERT IGNORE`.** The backend uses SQLAlchemy, and the tests run on
   SQLite, which doesn't understand `INSERT IGNORE`. Rewrite `grant_unlocks` with SQLAlchemy (for example, insert
   in a savepoint and catch `IntegrityError`, or pick the "ignore" prefix by dialect). The catalogue, `required_reward`,
   `rewards_for_wins` and `validate_changes` can be reused. Write the spec's SQL as models plus an Alembic migration
   (run `flask db migrate`, review it, `flask db upgrade`; migrations here use batch-op style).
6. **Modes and pages the site doesn't have.** The Rift home's Trials cards (Duel, Clash, Ranked, Custom), the nav
   (Play, Fighters, Rankings, Rewards) and the Battle HUD come from the concept art. The site only has **ranked 1v1
   Bo3**, there's no battle engine, and its routes are Hub, Ladder, Meta (characters), Tournaments, Queue, Match room,
   Profile, Party and Discord (see `frontend/src/App.tsx`). **(ask)** How the nav and Trials map onto real pages,
   and whether the Battle HUD should become the match room or be dropped.
7. **Per game or overall?** The site is split by game (`/:game/...`, 012 or NT). The spec has one `ranked_wins`
   count. **(ask)** Whether wins count across both games (simplest, and matches the spec) or per game.
8. **Cosmos and Chaos in a 1v1.** Matches have `player_a` (who waited longest, and hosts) and `player_b`. A sensible
   default: you are always shown as Cosmos and your opponent as Chaos, which matches the current colours (crystal
   = you, crimson = opponent). **(ask)** if the owner wants fixed sides instead.
9. **No browser tests yet.** The spec's acceptance checks use Playwright and axe, and neither is set up in `frontend/`.
   Add them when you reach step 9 of the spec's build order.

The spec's other open questions (forfeits counting as wins, more rewards, a switch sound) are still the owner's.

### Suggested order

The spec's build order, adjusted for React:
1. Theme package into `frontend/src/theme/`, fonts and CSS imported, Tailwind colours pointed at theme variables.
2. Backend: `ranked_wins`, `user_preferences`, `user_unlocks` (models + migration), backfill command, rewards
   logic in `confirm()`, then `GET/PATCH /api/me/appearance` and `GET /api/rewards`, with pytest tests first.
3. Appearance context + no-flash script, then the Rift layout, then the Classic layout, then switching and preview.
4. Victory reward card on the match result, then the acceptance checks in all themes and at phone width.

Steps 1 and 3 are frontend only and can start without the backend by using the defaults.

## Current state

### Git
- `main` holds only the first scaffold commit. **Nothing else is merged to `main`.**
- `feat/queue-matchmaking`, newest first:
  - the `docs:` commit adding this file, the spec and the theme package. **Local only, not pushed.**
  - `fa2da2e` Discord bot (queueing and notifications). **Local only, not pushed.**
  - `3286c6f` Bo3 ranked, region widening, background matchmaker. **Local only, not pushed.**
  - `b5d59f1` phase 1: real queue and matchmaking (web)
- `.DS_Store` in the repo root shows as modified. It's tracked by mistake despite `.gitignore`, so leave it out of
  commits (or untrack it with `git rm --cached .DS_Store` if the owner agrees).
- Commit IDs changed on 2026-11-21 when history was rewritten (see Security). Old IDs in older notes won't resolve.

### Security
- The first commit used to contain a real `.env`. On 2026-11-21 it was stripped from all history and every branch
  was force-pushed, so no branch on GitHub has it.
- GitHub still serves the old commit by its ID until GitHub Support purges it. **The owner said they'll contact
  GitHub themselves.** Any values from that old file that are still in use anywhere should be treated as public.
- The local database was recreated from scratch with the owner's new passwords. Never paste `.env` contents anywhere.

### Running it locally
```bash
docker compose up -d                                      # MariaDB, from the repo root (reads .env)
cd backend && FLASK_APP=run.py .venv/bin/flask db upgrade
FLASK_APP=run.py .venv/bin/flask run                      # API
FLASK_APP=run.py .venv/bin/flask bot                      # Discord bot (also runs the matchmaker)
cd frontend && npm run dev                                # site on http://localhost:5173
```
`.env` lives in the repo root (copy `.env.example`). All Discord values are filled in, and the bot is in the
owner's test server.

### Built
**Backend** (Flask, SQLAlchemy, Alembic, MariaDB; Python 3.12 in `backend/.venv`)
- Discord OAuth sign-in (`identify` scope), session cookie: `app/routes/auth.py`
- Profile and onboarding (region, games, in-game IDs): `app/routes/me.py`
- **Matchmaking core: `app/matchmaking.py`.** All queue and match rules, shared by the web API and the bot.
  1v1 only; prefers same region, widens to any region after 60s; accept window 60s; lifecycle
  `pending` → `active` → `reported` → `completed` | `disputed`, plus `cancelled` and `abandoned`.
  Functions never commit; callers do.
- REST API: `app/routes/queue.py`. `flask matchmaker` (`app/worker.py`) runs `tick()` every 2s when the bot isn't running.
- **Rewards and appearance: `app/rewards.py`** (the ladder lives in `REWARDS`; mirror goal changes in
  `frontend/src/theme/tokens.json`). `confirm()` credits the winner's `ranked_wins` and grants unlocks, each tagged
  with the match that earned it (`UserUnlock.match_id`), so the match shows the reward card to the winner whoever
  confirmed. API: `GET/PATCH /api/me/appearance`, `GET /api/rewards` (`app/routes/appearance.py`).
  `flask backfill-rewards` recounts wins from completed matches and grants missing unlocks (idempotent; run it on any
  database that had completed matches before this shipped).

**Discord bot** (tested live 2026-11-21, works): `app/bot.py`, `app/discord_service.py`, `GuildConfig` model.
`/arena setup`, `/queue [platform]`, `/leave`; a profile form on first queue; Accept/Decline DMs that survive restarts;
a role ping when someone searches (10-minute cooldown); @mention fallback when DMs are closed. Reporting is on the
website: the "Match on" DM links to the match room.

**Frontend** (React 19, Vite, Tailwind 4, React Router; `frontend/`)
- Real API: queue page, match-found modal and match room (`src/state/AppState.tsx` polls).
- **Interfaces:** `src/state/Appearance.tsx` (appearance context; caches to `localStorage['da-appearance']`, which the
  inline script in `index.html` applies before paint), `src/layouts/{Shell,RiftLayout,ClassicLayout}.tsx`,
  `src/components/appearance/*` (switcher, lock panel, preview banner, worlds, reward cards, Config window, victory
  card). `Card`/`Btn`/`Pill` in `ui.tsx` use `da-card`/`da-btn`/`da-pill`, styled per interface in `index.css`, so
  older pages become Classic windows without changes. Swatches of other worlds/windows set `data-world`/`data-window`
  on the swatch itself. Decisions taken: you are always Cosmos; the Cycle of War gauge shows your ranked W/L until
  seasons exist; Classic's Battle-HUD styling is the match room's score bar; nav maps to real pages.
- **Mock data (`src/data/mock.ts`):** Ladder, Tournaments, Party, Meta, Profile, Hub, Discord pages. `mock.ts` also
  holds per-game UI settings (`GAMES`) and the `GameId`/`Region` types that real pages import, so don't delete it
  wholesale.

### Tests
```bash
cd backend && .venv/bin/python -m pytest      # 172 pass: SQLite in memory, Discord mocked
cd frontend && npm run build && npm run lint   # clean
cd frontend && npm run test:e2e                # Playwright + axe, API mocked (no backend needed)
```
The e2e suite covers lock panel, preview (incl. no flash on reload), switching, 403 revert, the command menu keys,
custom colour, colour contrast in all 6 worlds and 9 windows, and phone width. axe ignores `clip-path`, so the Rift
hero's Cosmos half is excluded from axe and its colour pairs are checked directly in the test.

**macOS port 5000:** AirPlay Receiver (Control Center) listens on `*:5000`. Flask still binds `127.0.0.1:5000` and the
Vite proxy reaches it, but if requests to `/api` ever return Apple 403s, turn off AirPlay Receiver or move the port.
`.claude/launch.json` has `api` and `web` entries for the preview tools.
SQLite ignores row-locking clauses, so concurrent pairing is only truly exercised on MariaDB.

## Known gaps (not the design phase's job unless asked)
1. **No ratings or seasons.** Completed matches only count toward `ranked_wins` (and so rewards).
   Planned: a `Season` table per game, Glicko-2 ratings per player/game/season, soft reset each season, players hidden
   from the ladder until about 5 matches. Then move Ladder and Profile off mock data.
2. **Disputes aren't reviewed yet.** Players file games and a reason and each add their side (#6), but Rulings come
   with the Admin panel (#3). Reported results confirm themselves after 2 hours (#7). The Master and Admins exist,
   with the Master panel and the Admin log page (#5), but there are no cases or Rulings yet (#8).
   `GuildConfig.mod_role_id` is stored but unused.
3. **No penalties.** `Match.ended_by_id` records who declined, timed out or abandoned.
4. **Pings only fire on Discord `/queue`,** not when someone queues on the website.
5. Polling everywhere (site every few seconds, bot every 2s). Fine at this scale.
6. No deployment yet (backend, bot and matchmaker as `docker-compose` services).

## Lobby automation (research only, nothing built)
- **NT: not feasible.** No public API; automating it means reverse-engineering or input scripting, which is fragile
  and likely against the terms of service. The bot's "who hosts + both IDs" handoff is the approach.
- **012 (PPSSPP): worth a time-boxed test later.** PPSSPP's WebSocket debugger could let a companion app read results
  from memory to auto-report (still needing opponent confirmation). Test reading results before building anything.

## Conventions
- Game rules live in `matchmaking.py`. Routes and the bot stay thin. Bot database work goes in `discord_service.py`.
- After a model change: `flask db migrate`, review the file, `flask db upgrade`.
- JSON-only POST/PATCH endpoints (a CSRF measure). Errors are `{"error": code, "message"}`. The spec's 403 body
  (`{"error": "locked", "reward", "goal", "remaining"}`) fits this. Add a `message` too.
- Commits use conventional prefixes (`feat:`, `fix:`, `chore:`). Commit only when the owner asks. Never commit `.env`.
- Keep the "a fan project" line in the footer. The themes use no official logos, art or fonts.

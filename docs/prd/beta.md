# Beta launch PRD

Status: draft, 2026-11-25. Owner: the Master.

This document plans the work between the code on `main` and a beta with real players. Read it before you plan, spec or build any Stage 1, 2 or 3 work. Use the terms in `GLOSSARY.md`. `HANDOFF.md` describes what is already built and how to run it.

## Problem

The match flow is finished and tested. A player can sign in with Discord, queue from the site or the bot, play a Bo3, report it and settle it. Admins resolve Disputed matches, Help requests and stuck matches, and every action goes in the Admin log.

Four things stop a beta:

1. The default Rift interface looks generated. Players judge the beta by it first.
2. Nothing is deployed. There is no production server, domain, HTTPS or backup, and no issue covers it.
3. Ladder, Hub, Profile, Match details, Meta, Tournaments, Party and Friends show invented data from `frontend/src/data/mock.ts`.
4. Ratings and Seasons don't exist yet. Issues #14 to #20 cover them.

## Plan

The beta ships in three stages, in order. Each stage starts when the stage before it meets its completion criteria.

| Stage | Outcome | Blocks |
|---|---|---|
| 1. Default interface redesign | The Rift interface has its own fantasy look, with new fonts | Stage 2 |
| 2. Pre-season beta | The site is deployed and players use it, with no Ratings | Stage 3 |
| 3. Season 1 | Ratings and Ladders are live, and the Master has started Season 1 | Nothing |

Stage 1 comes before deployment so that the pages Stage 2 changes are built once, on the new design.

A beta can run before Ratings exist because of a rule in #4: a match settled before its game's Season 1 creates no Rating but still counts toward ranked wins and unlocks. Pre-season matches never reach the first Ladder.

## Stage 1: default interface redesign

### Goal

Rework the default Rift interface into a fantasy look that feels made for this community. Fonts change first. Spacing, hierarchy, ornament, colour and copy follow. The redesign covers the pages that ship in the beta. Hidden pages wait.

### Hard rules

- The site is a fan project. Use no official Dissidia or Final Fantasy logos, art or fonts. Keep the "a fan project" line in the footer.
- Colours come from `frontend/src/theme/tokens.json` through CSS custom properties. CI fails when a `.tsx` file contains a hex colour.
- The Classic interface and its unlocks keep working. Classic windows share the `da-card`, `da-btn` and `da-pill` classes with Rift, so a Rift change to those classes reaches Classic too.
- Every world passes the colour contrast checks in `frontend/e2e/appearance.spec.ts`, at desktop and phone width.
- The no-flash script in `frontend/index.html` still applies the cached appearance before first paint.

### Where the current look lives

- Font families: `rift.fonts` in `frontend/src/theme/tokens.json`, loaded by `frontend/src/theme/css/fonts.css`. Rift uses Cinzel Decorative for the brand, Cinzel for headings, Cormorant Garamond for lore text and Inter for body text. Kalam, imported in `frontend/src/index.css`, is only for handwritten notes.
- Interface styles: `frontend/src/theme/css/dissidia-theme.css` and `frontend/src/index.css`.
- Layouts: `frontend/src/layouts/RiftLayout.tsx`, `ClassicLayout.tsx` and `Shell.tsx`.
- Shared components: `frontend/src/components/ui.tsx`.
- Theme SVGs: `frontend/src/theme/assets/`, with crystal, cosmos, chaos and glove.
- The original theme spec: `Spec Files/Dissidia Arena — Theme & Interface Tech Spec.md`. Quote the path, since it contains spaces and an em dash. The theme package's values win over the spec, and the spec's behaviour wins over the package.

### Font pairings to trial

Cinzel and Inter are two of the most common fonts on generated sites. These pairings are all on Google Fonts:

| Pairing | Titles | Body text | Character |
|---|---|---|---|
| Storybook | Alegreya SC | Alegreya Sans | Calligraphic, like a printed fantasy novel. The most readable of the four. |
| Old print | IM Fell English SC | Spectral | Antique and inked, with rough edges. The strongest atmosphere. |
| Engraved | Cormorant SC, bold | Source Serif 4 | Keeps today's elegance without Cinzel. Serif throughout. |
| Blackletter accent | Grenze Gotisch, for the brand and Chaos only | Grenze | Sharp and dark, and suits the Cosmos and Chaos split. Use it sparingly. |

### Open questions for the grilling session

The owner answers these before anyone builds Stage 1:

1. Which font pairing wins, after a side-by-side trial on Home and the match room?
2. How deep does the redesign go? New fonts and polish only, or a restyle of the Rift layout itself?
3. What does "fantasy" mean here? Name two or three reference sources, such as old fantasy print, a game's menu style or a book's typesetting.
4. Do all six worlds get the full redesign, or does the default Dissidia world lead and the other five get a colour pass?
5. Which pages ship in the beta and get redesigned, and which are hidden? See the page list in Stage 2.
6. What is the time box? Two weeks is the suggestion.
7. Does the Classic interface change at all, or only stay unbroken?

### Checklist

Direction:

- [ ] Open a GitHub issue for the redesign and branch off `main` as `feat/<short-slug>`.
- [ ] Review Home, Hub, Queue, the match room, Admin cases and the Rift layout with the `unslop` skill, and list each generated-looking pattern with its file.
- [ ] The owner agrees a fantasy direction with a short reference board.
- [ ] The owner sets the time box.

Fonts:

- [ ] Render two or three pairings side by side on Home and the match room, in a light world and a dark world.
- [ ] The owner picks one pairing.
- [ ] Swap the families in `fonts.css` and `rift.fonts`, and confirm that every weight loads with no fallback font showing.

Restyle:

- [ ] Reduce the type scale to four sizes with clear title weight.
- [ ] Rework spacing and layout on each page that ships in the beta.
- [ ] Replace generic shapes with custom SVG dividers, frames and crystal motifs, built from the theme's assets.
- [ ] Do a colour pass through the tokens in every world the owner chose.
- [ ] Rewrite button labels, empty states and headings in the site's own voice.
- [ ] Add at most one purposeful motion, such as the match-found reveal, and turn it off under `prefers-reduced-motion`.

Sign-off:

- [ ] The Classic interface and every unlock still render correctly.
- [ ] Lint, build and the Playwright suite with axe pass. Tests change only where the layout changed on purpose.
- [ ] The owner signs off on before and after screenshots of each redesigned page.

Stage 1 is complete when every box above is ticked and the redesign PR is merged.

## Stage 2: pre-season beta

### Finish Admin panel part one

- [ ] #13: the Master reopens settled matches. It is the only way to fix a wrong Ruling or a wrong auto-confirm.

### Remove invented data

Every number a player sees comes from the database, or the page says the feature isn't ready. `mock.ts` also holds `GAMES`, `GameId` and `Region`, which real pages import, so remove only the mock data.

- [ ] The Ladder page shows that Ratings haven't started. #15 later replaces it with the live Ladder.
- [ ] The Hub drops the mock top list and the mock recent matches.
- [ ] Add API endpoints for a player's public profile and their settled matches. No issue exists for these yet.
- [ ] Profile and Match details read from those endpoints.
- [ ] Meta, Tournaments, Party, Friends, the Discord suggestions, the sidebar friends list and the 3v3 queue option are hidden or marked as coming later, as the owner decides.
- [ ] Placeholder copy such as "Ratings are coming soon" says what is true in the beta.

### Hosting

The owner chose the host on 2026-11-25. The owner lives in the UK.

- **Server.** One Hetzner Cloud CX23 with 2 vCPU, 4 GB RAM and a 40 GB disk, in a German location, Nuremberg or Falkenstein. Hetzner has no UK data centre, and Germany gives UK players about 15 to 25 ms of delay. When the CX23 can't be ordered, use the next Hetzner plan with at least 2 vCPU and 4 GB RAM.
- **Cost.** About €5.49 a month before VAT after Hetzner's June 2026 price rise, plus €0.50 for an IPv4 address. Hetzner bills in euros and charges VAT by the customer's country, so expect UK VAT on top. The total is about £6 to £7 a month, plus the domain.
- **What runs on it.** Docker Compose runs the API, the bot, MariaDB and Caddy. Caddy gets HTTPS certificates on its own, serves the built frontend and passes `/api` to the API on the same origin.
- **DNS and domain.** Cloudflare's free plan. Cloudflare Registrar sells domains at cost, about £8 a year for a `.com`.
- **Backups.** A nightly job copies a MariaDB dump and the uploads folder to Cloudflare R2 or Backblaze B2. Both give 10 GB free.

The bot holds a connection to Discord and runs `tick()` every 2 seconds, so it must run all the time. Free tiers that sleep idle apps or run only short requests, such as Render's and Vercel's, stop the bot, and with it pairing, accept timeouts and auto-confirm. Oracle Cloud's Always Free tier reclaims a server whose CPU stays under 20% for 7 days, which this mostly idle site would trigger. Railway bills each service and the database separately, and would cost more than the server.

### Deploy

- [ ] Open a deployment issue.
- [ ] The owner opens a Hetzner account. Hetzner may ask for a passport or a prepayment from the owner's own credit card, and a VPN makes that check harder, so sign up without one.
- [ ] The owner registers the domain with Cloudflare and points its DNS at the server.
- [ ] Build containers for the API, the bot and the static frontend, and a production `docker-compose` file that runs them with MariaDB and Caddy. The API needs a production WSGI server such as gunicorn, which `backend/requirements.txt` does not include yet.
- [ ] Run exactly one matchmaker. The bot runs `tick()`, so production never runs `flask matchmaker` alongside the bot.
- [ ] Caddy serves the frontend and `/api` from one origin with HTTPS, so the session cookie stays same-origin.
- [ ] Write the production `.env` with a new `SECRET_KEY`, `SESSION_COOKIE_SECURE=true`, the real `FRONTEND_URL` and `DISCORD_REDIRECT_URI`, and `MASTER_DISCORD_ID`.
- [ ] The owner adds the production redirect URL to the Discord application.
- [ ] Mount a persistent volume at `UPLOAD_DIR`, or screenshots vanish on redeploy.
- [ ] Run `flask db upgrade` before each new API version starts.
- [ ] Back up MariaDB and the uploads folder nightly to R2 or B2, and test one restore onto a fresh server.
- [ ] Add an uptime check on `/api/health` and an alert when the bot stops.
- [ ] Run two accounts on a MariaDB staging copy. The tests use SQLite, which ignores row locks, so only MariaDB tests concurrent pairing.

### Security

- [ ] The owner confirms that every secret from the leaked `.env` is rotated and that GitHub has purged commit `ffeb33b`.
- [ ] Run a security review of `main`, covering the Admin routes, uploads and the session. CSRF protection relies on `SameSite=Lax` plus a required header on uploads.
- [ ] Add rate limits to sign-in, uploads, match messages and disputes.

### People and community

- [ ] The Master appoints at least one Admin. Each Admin signs in once before the Master can appoint them.
- [ ] The owner adds the bot to each game's server and runs `/arena setup`.
- [ ] Publish a rules page covering reporting, disputes, Help requests and Admin powers.
- [ ] Publish a privacy note listing what is stored: Discord ID, name and avatar, region, in-game IDs, match history, and Screenshots, which are deleted 90 days after a case closes.
- [ ] The owner opens a beta feedback channel in Discord, and the site footer links to it.

### Final check

- [ ] Two real accounts on production queue, accept, play, report and confirm, once from the site and once from Discord.
- [ ] The same two accounts run a dispute with Screenshots through to a Ruling, and the Admin log and DMs are correct.
- [ ] Queue, the match room, the dispute form and Admin cases work at phone width.
- [ ] Update the known gaps in `HANDOFF.md`.

Stage 2 is complete when every box is ticked and the first outside player has settled a match on production.

## Stage 3: Season 1

The open tickets under #4. Each is labelled `ready-for-agent`, so its spec is settled.

- [ ] #14: the Master starts Season 1, and settled matches move Ratings.
- [ ] #15: live Ladders on real data.
- [ ] #16: Season rollover, Soft reset and frozen standings.
- [ ] #20: Rulings and reopening move Ratings correctly.
- [ ] #17: Admin Season tools to schedule and extend. Rollover runs on defaults without it.
- [ ] #19: Rating reset of one player.
- [ ] The Master presses Start Season 1 for each beta game and announces it in each queue channel.

#16 must merge within a month of the Master starting Season 1. Season 1 ends after one calendar month, and without rollover it never ends.

Stage 3 is complete when Season 1 is live on every beta game and #14, #15, #16 and #20 are merged.

## Beta success measures

The owner may adjust these targets.

- At least 20 players complete a match in the first two weeks.
- 90% of matches settle by confirm or auto-confirm, with no Admin.
- Every Disputed match gets a Ruling within 48 hours.
- No match stays open for more than 24 hours.
- The restore test succeeds, and no data is lost.

## Out of scope for the beta

- #18, the Hard reset scheduled by the Master.
- Penalties for bad-faith disputes, abandons and declines.
- Role pings when someone queues on the website. Pings fire only on Discord `/queue`.
- Reporting results and Admin actions through Discord commands.
- Lobby automation.
- 3v3, party queue, Tournaments and Friends.
- Named tiers, Rating-aware matchmaking, Season rewards and Discord roles for placings.
- Cloud storage for Screenshots, and replacing polling.

## Owner decisions still open

Stage 1 has its own questions above. These cover the rest of the beta:

1. Does the beta open for both games, or for 012 first? `HANDOFF.md` names the 012 website as the focus.
2. Is the beta closed or open? Anyone with Discord can sign in today. A closed beta needs an allowlist, which needs its own issue.
3. Which domain name? The host is settled. See Hosting in Stage 2.
4. Does #13 block Stage 2? This document assumes it does.

## Risks

| Risk | Effect | Mitigation |
|---|---|---|
| The redesign keeps growing | Stage 1 blocks deployment, so the beta slips | Keep the time box, and redesign only the pages that ship |
| Season 1 ends before #16 merges | The first Season never ends | Start Season 1 only after #16 merges, or merge it within the first month |
| The bot stops | Pairing, accept timeouts, auto-confirm and the Screenshot purge all stop with it | Restart policy, an uptime alert, and `flask matchmaker` as a fallback |
| Only the owner rules on disputes | Rulings slow down, and the owner rules on their own matches | Appoint Admins in Stage 2 |
| Few players search at once | Waits grow and players leave | Agree set play times in each Discord server |
| A bug appears only on MariaDB | Concurrent pairing fails in production | The staging run in Stage 2 |
| Everything runs on one server | A server failure takes the site, the bot and the database down together | Off-site nightly backups, a tested restore onto a fresh server, and the uptime alert |

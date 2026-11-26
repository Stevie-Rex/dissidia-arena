# Beta launch PRD

Status: draft, 2026-11-25. Updated 2026-11-26 with the decisions from Lab round 1 (#40). Owner: the Master.

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
| 1. Default interface redesign | The Rift interface has its own esports-meets-fantasy look, with new fonts, a sidebar and a new Admin panel | Stage 2 |
| 2. Pre-season beta | The site is deployed and players use it, with no Ratings | Stage 3 |
| 3. Season 1 | Ratings and Ladders are live, and the Master has started Season 1 | Nothing |

Stage 1 comes before deployment so that the pages Stage 2 changes are built once, on the new design.

A beta can run before Ratings exist because of a rule in #4: a match settled before its game's Season 1 creates no Rating but still counts toward ranked wins and unlocks. Pre-season matches never reach the first Ladder.

## Stage 1: default interface redesign

### Goal

Rebuild the default Rift interface so it looks made for this community, not generated. The look is a hybrid: an esports portal in structure, dense, bold and driven by stats, with a fantasy layer drawn from Final Fantasy's feel, such as Cosmos and Chaos, crystals and engraved display type. Layout, fonts, components, colour, copy and the Admin pages all change. Pages hidden in the beta wait until they launch.

The owner settled the direction in a grilling session on 2026-11-25, and picked the look by eye in Lab round 1 (#40), which closed on 2026-11-26. The decisions below replace the open questions this section used to hold. The dark mode is final. The light mode's design is still open in #55. A spec breaks this work into tickets before anyone builds it.

### Hard rules

- The site is a fan project. Use no official Dissidia or Final Fantasy logos, art or fonts. Keep the "a fan project" line in the footer.
- Colours come from `frontend/src/theme/tokens.json` through CSS custom properties. CI fails when a `.tsx` file contains a hex colour.
- The Classic interface and its unlocks keep working. Classic windows share the `da-card`, `da-btn` and `da-pill` classes with Rift, so scope new styles to Rift, and check Classic with screenshots after each change.
- Rift's dark and light modes pass the colour contrast checks in `frontend/e2e/appearance.spec.ts`, at desktop and phone width.
- The no-flash script in `frontend/index.html` still applies the cached appearance before first paint.
- Motion turns off under `prefers-reduced-motion`.

### Where the current look lives

- Font families: `rift.fonts` in `frontend/src/theme/tokens.json`, loaded by `frontend/src/theme/css/fonts.css`. Rift uses Cinzel Decorative for the brand, Cinzel for headings, Cormorant Garamond for lore text and Inter for body text. Kalam, imported in `frontend/src/index.css`, is only for handwritten notes.
- Interface styles: `frontend/src/theme/css/dissidia-theme.css` and `frontend/src/index.css`.
- Layouts: `frontend/src/layouts/RiftLayout.tsx`, `ClassicLayout.tsx` and `Shell.tsx`.
- Shared components: `frontend/src/components/ui.tsx`.
- Theme SVGs: `frontend/src/theme/assets/`, with crystal, cosmos, chaos and glove.
- The owner's reference images: `UI Designs/UI design ideas/`. Ideas one to four are esports and guild sites. The owner also pointed to the home screen of Dissidia Duellum for its emblem tile bar, player card, Season progress bar, slanted banner cards and frosted panels.
- The original theme spec: `Spec Files/Dissidia Arena — Theme & Interface Tech Spec.md`. Quote the path, since it contains spaces and an em dash. This section wins over the spec wherever they disagree.

### Decisions

**Scope and pace**

- Restyle everything in Rift: layout, fonts, components, colour, copy and the Admin pages.
- There is no time box. Each piece merges when the owner has reviewed it.
- Meta, Tournaments, Party, Friends, the Discord suggestions and the 3v3 queue option stay hidden in the beta, and are redesigned when they launch.
- Classic only has to keep working in Stage 1. Its own restyle, with the sidebar, is separate work after Stage 1.

**Appearance**

- Rift is dark by default. Light is the only other Rift appearance.
- The dark mode is final, as recorded on #40. The light mode needs another design pass, closer to the Dissidia 012 menus, in #55. Its palette, frames and buttons come from there.
- Worlds are removed. See `docs/adr/0001-remove-rift-worlds.md`. Classic's window themes are a separate setting and stay, with their unlocks.

**Fonts**

Three roles replace today's four families. The owner picked this set in the lab:

| Role | Use | Font |
|---|---|---|
| Display | The brand, big titles and the match score. This carries the fantasy feel. | Marcellus SC |
| Heading | Section headings, numbers and stats. This carries the esports energy. | Chakra Petch |
| Body | Everything else | Barlow |

Cinzel and Inter are out.

**Icons and menus**

- Icons come from game-icons.net (CC BY 3.0), so the site needs a credits page naming the authors.
- Icons sit in bevelled diamond crest frames.
- Menus borrow patterns from the Dissidia 012 menus, redrawn and with no art copied: stacked bars with a silver edge, a selection-blue highlighted row with a crystal-shard cursor, slanted title tabs, ◀ value ▶ pickers, and a help strip along the bottom of the page that explains what the pointer is on. Selection blue appears on menus only.
- The Settings icon is the game-icons gears.

**Shell**

- Desktop has a left sidebar instead of the top navigation bar. From top to bottom it holds:
  - the game switcher, with an emblem for 012 and for NT;
  - the player card, with avatar, name, ranked wins and a progress bar to the next unlock, in one colour, Cosmos blue. Stage 3 adds the Season emblem;
  - navigation as Dissidia 012 menu bars: Hub, Queue, Ladder, Profile and Rewards;
  - an Admin link, shown only to Admins;
  - at the bottom, settings, the light and dark toggle, and the Discord feedback link.
- Searching and an open match show in one place on every page: a floating card in the bottom-right corner with a timer and an action. When a match is found the card grows, glows and plays a short chime. The chime follows its own Sound setting, not reduced motion.
- Phones are designed for second. Queue, the match room, reporting, the dispute form and Admin cases are fully designed at phone width. Other pages only need to stack cleanly.
- The phone navigation is a bottom bar of emblem tiles with condensed labels: Hub, Ladder, Queue, Profile and More. Queue sits in the centre at the same size as the other tiles. The emblems are framed crests.

**Pages**

- Home has a large hero slot. In the beta it holds an abstract Cosmos and Chaos composition built from the theme's SVGs: a split of light and dark with a crystal at the seam, and a slow shimmer that moves in one direction. It has no sun rays and nothing spins. The slot is built so commissioned art can replace it later.
- Home and Hub put frosted glass panels over that dimmed backdrop. Queue, the match room and the Admin pages use a plain dark background, so they stay readable.
- Hub carries slanted banner cards in the Blade v2 style (a silver bevelled edge and a slanted title tab), built only from real data: joining the queue with the number of players searching, your open match, and the Season status, such as "Pre-season: wins still count". They replace the mock top list and recent matches.

**Voice**

- Anything a player clicks has a plain, punchy label, such as "Queue", "Report result" or "Dispute".
- Flavour goes only where it can't cause a mistake: headings and empty states. For example: "No battles fought yet. The Rift is waiting."

**Motion**

- The site gets a signature match-found animation, the crystal shatter, plus hover and press feedback.

**Admin**

- There is one Admin panel with three tabs: Cases, Log, and Admins. Only the Master sees the Admins tab, which lists the Admins with a remove button and puts the search to appoint one above it. Permissions don't change. The Master keeps the sole power to appoint and remove Admins, reopen Settled matches and take over a Claim.
- Admin pages use the same design system as player pages, at a denser setting, without the hero, glass panels or banner cards. They drop the Friends sidebar.
- Cases is a dense table, with one row per Disputed match or Help request. Columns show a type badge (Dispute or Help, in different colours), the match, the players, the game, the age, such as "12 min ago", and the Claim (Unclaimed, or the Admin's name). Filter chips: All, Disputes, Help, Unclaimed and Mine.
- A case page reads top to bottom in the order an Admin decides. First a summary strip shows the players, the game, the status and the Claim. Next comes the evidence: reported games, both statements and Screenshots. Match chat and dispute records follow.
- The Admin can see the evidence while writing a Ruling, or while closing or voiding a Help request. On desktop the form stays in view in a right-hand column while the evidence scrolls. On a phone a "Write ruling" bar pinned to the bottom opens a half-height panel, and the evidence scrolls above it. The text typed so far is saved as a draft on the device, so scrolling, closing the panel or reloading never loses it.
- The Admin log shows one compact row per action: the time, the actor's avatar, an action badge coloured by kind (such as Ruling, Claim, Void or appoint), and a link to the target. Filters by action and by Admin.

### How the work runs

1. **Lab, round 1 (done, #40).** A dev-only `/lab` route on its own branch, `feat/lab-round-1`, which never merges. It uses the real components with fixed sample data, so `npm run dev` shows it with no backend or Discord sign-in. It holds:
   - the font sets, switchable, on a Home mock and a match room mock;
   - the dark shell with the sidebar and game switcher;
   - both places for searching and open match status;
   - two or three styles of Hub banner card;
   - the phone bottom bar;
   - two or three match-found animations, with hover and press feedback;
   - Home's hero with glass panels.

   The light mode continues in the lab in #55.
2. **Lab, round 2.** The Admin panel, built on the font set and shell chosen in round 1.
3. **Build.** One parent issue with several pull requests, each leaving the site working. A likely order: the foundation (fonts, tokens, dark and light modes, removing worlds, the sidebar shell), then the match flow pages, then Home, Welcome, Hub and the remaining pages, then the Admin panel. The spec sets the final split.
4. **Review.** Each pull request opens as a draft with before and after screenshots at desktop and phone width, and the commands to run the branch locally. The owner tests it and leaves feedback in the pull request or the chat. The pull request leaves draft only when the owner signs off.

### Later, separate work

- Restyle the Classic interface and give it the sidebar.
- Rift's own cosmetic unlocks, such as player card frames, sidebar emblems and Profile banners, so Rift players have something on the unlock bar besides Classic items.
- Commissioned art for Home's hero slot.

### Checklist

- [ ] Write the Stage 1 spec and break it into tickets.
- [ ] Lab, round 1: the owner picks the font set, the place for match status, the banner card style, the motion and the bottom bar.
- [ ] Lab, round 2: the owner approves the Admin panel.
- [ ] Remove worlds from the frontend, the API and the database.
- [ ] Build and merge every Stage 1 pull request, each signed off by the owner.
- [ ] The Classic interface and every unlock still render correctly.
- [ ] Lint, build and the Playwright suite with axe pass. Tests change only where the layout changed on purpose.

Stage 1 is complete when every box above is ticked.

## Stage 2: pre-season beta

### Finish Admin panel part one

- [ ] #13: the Master reopens settled matches. It is the only way to fix a wrong Ruling or a wrong auto-confirm.

### Remove invented data

Every number a player sees comes from the database, or the page says the feature isn't ready. `mock.ts` also holds `GAMES`, `GameId` and `Region`, which real pages import, so remove only the mock data.

- [ ] The Ladder page shows that Ratings haven't started. #15 later replaces it with the live Ladder.
- [ ] The Hub drops the mock top list and the mock recent matches.
- [ ] Add API endpoints for a player's public profile and their settled matches. No issue exists for these yet.
- [ ] Profile and Match details read from those endpoints.
- [ ] Meta, Tournaments, Party, Friends, the Discord suggestions, the sidebar friends list and the 3v3 queue option are hidden. The owner decided this on 2026-11-25.
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

The owner settled Stage 1's questions on 2026-11-25. These cover the rest of the beta:

1. Does the beta open for both games, or for 012 first? `HANDOFF.md` names the 012 website as the focus.
2. Is the beta closed or open? Anyone with Discord can sign in today. A closed beta needs an allowlist, which needs its own issue.
3. Which domain name? The host is settled. See Hosting in Stage 2.
4. Does #13 block Stage 2? This document assumes it does.

## Risks

| Risk | Effect | Mitigation |
|---|---|---|
| The redesign keeps growing | Stage 1 blocks deployment, so the beta slips | Settle choices in the lab before building, merge in small pull requests, and leave hidden pages until they launch |
| Season 1 ends before #16 merges | The first Season never ends | Start Season 1 only after #16 merges, or merge it within the first month |
| The bot stops | Pairing, accept timeouts, auto-confirm and the Screenshot purge all stop with it | Restart policy, an uptime alert, and `flask matchmaker` as a fallback |
| Only the owner rules on disputes | Rulings slow down, and the owner rules on their own matches | Appoint Admins in Stage 2 |
| Few players search at once | Waits grow and players leave | Agree set play times in each Discord server |
| A bug appears only on MariaDB | Concurrent pairing fails in production | The staging run in Stage 2 |
| Everything runs on one server | A server failure takes the site, the bot and the database down together | Off-site nightly backups, a tested restore onto a fresh server, and the uptime alert |

# Coding standards

Rules for reviewing a change. Each one is a judgement call; anything mechanical is a check in CI (`.github/workflows/tests.yml`).

## Domain language

- Names, test names and user-facing text use the terms in `GLOSSARY.md` (Ruling, Disputed match, Settled match, Claim…). A synonym the glossary lists under _Avoid_ is a finding.

## Backend

- **Layers.** Game rules live in `matchmaking.py`, case work in `cases.py`, and settling a match only in `settlement.py`. Routes and the bot stay thin; bot database work goes in `discord_service.py`.
- **Transactions.** Domain functions work on the current `db.session`, take the match already locked (`matchmaking.lock_match`, or `cases.act` for case routes), raise `MatchmakingError`, and leave committing to the caller.
- **Match lifecycle.** A change that adds or reopens a status transition accounts for every other way a match moves (accept, leave, report, confirm, dispute, `tick()`, each Ruling) and for everything keyed on the status: `OPEN_STATUSES` and `current_match`, the queue, `notified_status`, and dispute records.
- **Refuse before changing.** A function that can refuse checks everything first, then changes state. The route's rollback on error is a safety net, not the design.
- **API shape.** POST/PATCH endpoints take JSON only (a CSRF measure). Errors are `{"error": code, "message", "fields"?}`, with `fields` naming each invalid input.
- **Tests** go through the Flask test client (or the `svc`/`bot` seam for Discord), using `clock.now()` rather than real time.

## Frontend

- **Owner sign-off.** A change to what players see links the `/lab` prototype the owner signed off, or says it's a bug fix restoring the signed-off look. It stays a draft until the owner signs it off. A UI change without either is a finding.

- **State that belongs to one entity resets with it.** When a component holds form or UI state for a case, match or player, and the route can swap that entity without unmounting it, key the component on the entity's id. The same goes for a part that can be replaced inside one match, such as a new dispute after a Replay.
- **Colours** come from the theme's tokens and Tailwind theme colours.
- **Browser checks** mock every `/api` call and run axe on the page under test.

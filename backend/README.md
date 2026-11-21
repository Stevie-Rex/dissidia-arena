# Backend (Flask)

## Setup

```bash
cp .env.example .env            # from repo root, then fill it in
docker compose up -d db         # MariaDB
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
FLASK_APP=run.py .venv/bin/flask db upgrade
.venv/bin/python run.py         # http://127.0.0.1:5000
```

Run the frontend with `npm run dev` in `frontend/`. Vite proxies `/api` to Flask, so the
browser only ever talks to `http://localhost:5173` and the session cookie is same-origin.

## Discord sign-in

1. Create an application at https://discord.com/developers/applications.
2. Under **OAuth2**, copy the Client ID and Client Secret into `.env`.
3. Under **OAuth2 → Redirects**, add `http://localhost:5173/api/auth/discord/callback`
   (exactly matching `DISCORD_REDIRECT_URI`).

Only the `identify` scope is requested (username + avatar).

| Endpoint | |
|---|---|
| `GET /api/auth/discord/login?next=/path` | Redirects to Discord |
| `GET /api/auth/discord/callback` | Discord redirects here; creates/updates the user and sets the session |
| `POST /api/auth/logout` | Clears the session |
| `GET /api/me` | Current user, or 401 |
| `PATCH /api/me` | Update `games`, `region`, `gameIds`, `onboarded` (JSON only) |
| `GET /api/health` | DB connectivity check |

## Matchmaker

Pairing and accept timeouts run on a timer, so players who queue from Discord get matched
without ever loading the site. The bot runs this loop itself; without the bot, run:

```bash
FLASK_APP=run.py .venv/bin/flask matchmaker
```

## Discord bot

Uses the same Discord application as sign-in.

1. Developer portal → your app → **Bot** → *Reset Token*, and put it in `.env` as `DISCORD_BOT_TOKEN`.
   No privileged intents are needed.
2. **Installation** (or OAuth2 → URL Generator): scopes `bot` + `applications.commands`, permissions
   *Send Messages*, *Embed Links*, *View Channels* (and *Mention All Roles* if the ping role isn't mentionable).
   Open the URL to add the bot to a server.
3. While developing, set `DISCORD_DEV_GUILD_ID` to your test server's ID so slash commands appear
   instantly (global sync can take a while the first time).
4. `FLASK_APP=run.py .venv/bin/flask bot`
5. In the server, someone with *Manage Server* runs `/arena setup` to pick the game, queue channel
   and optional ping role.

| Command | |
|---|---|
| `/arena setup game queue_channel [ping_role] [mod_role]` | Admins: link this server to 012 or NT |
| `/queue [platform]` | Search (platform is PS4/PC, NT only). First time asks for in-game ID and region |
| `/leave` | Stop searching |

Match found / match on / cancelled arrive as DMs with Accept and Decline buttons, or as an @mention
in the queue channel if the player's DMs are closed. Reporting results is on the website for now.

## Tests

```bash
.venv/bin/python -m pytest
```

Tests use in-memory SQLite and mock Discord's API, so they need neither MariaDB nor credentials.

## Migrations

After changing models: `FLASK_APP=run.py .venv/bin/flask db migrate -m "describe change"`,
review the generated file in `migrations/versions/`, then `flask db upgrade`.

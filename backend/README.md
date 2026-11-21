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

## Tests

```bash
.venv/bin/python -m pytest
```

Tests use in-memory SQLite and mock Discord's API, so they need neither MariaDB nor credentials.

## Migrations

After changing models: `FLASK_APP=run.py .venv/bin/flask db migrate -m "describe change"`,
review the generated file in `migrations/versions/`, then `flask db upgrade`.

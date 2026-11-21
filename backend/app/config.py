import os
from pathlib import Path
from urllib.parse import quote

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")


def _database_url() -> str:
    if url := os.environ.get("DATABASE_URL"):
        return url
    return (
        f"mysql+pymysql://{quote(os.environ['MARIADB_USER'], safe='')}:{quote(os.environ['MARIADB_PASSWORD'], safe='')}"
        f"@{os.environ.get('DB_HOST', 'localhost')}:3306/{os.environ['MARIADB_DATABASE']}"
        "?charset=utf8mb4"
    )


class Config:
    SECRET_KEY = os.environ["SECRET_KEY"]
    SQLALCHEMY_DATABASE_URI = _database_url()
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}

    # Session cookie (signed by SECRET_KEY). Lax lets it survive the top-level
    # redirect back from Discord while still blocking cross-site POSTs.
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = os.environ.get("SESSION_COOKIE_SECURE", "false").lower() == "true"

    # Discord OAuth2 — create an application at https://discord.com/developers/applications
    DISCORD_CLIENT_ID = os.environ.get("DISCORD_CLIENT_ID", "")
    DISCORD_CLIENT_SECRET = os.environ.get("DISCORD_CLIENT_SECRET", "")
    # Must exactly match a redirect registered on the Discord application.
    DISCORD_REDIRECT_URI = os.environ.get(
        "DISCORD_REDIRECT_URI", "http://localhost:5173/api/auth/discord/callback"
    )
    # Discord bot (same application): Bot -> Reset Token. Only needed to run `flask bot`.
    DISCORD_BOT_TOKEN = os.environ.get("DISCORD_BOT_TOKEN", "")
    # Optional: sync slash commands to this one server instantly while developing.
    DISCORD_DEV_GUILD_ID = os.environ.get("DISCORD_DEV_GUILD_ID", "")
    # Where to send the browser after login (the Vite dev server in development).
    FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")

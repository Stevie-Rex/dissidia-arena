"""The match room's system messages: what the site posts in a match's chat, not either player."""

from . import clock
from .models import Match, MatchMessage


def post_system(match: Match, text: str) -> None:
    match.messages.append(MatchMessage(user_id=None, text=text, created_at=clock.now()))

"""The error the rules modules raise: a code, a message, an HTTP status and optional field errors.

Its own module so the Settlement module can raise it without importing the matchmaking core.
"""


class MatchmakingError(Exception):
    def __init__(self, code: str, message: str, status: int = 409, fields: dict | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields

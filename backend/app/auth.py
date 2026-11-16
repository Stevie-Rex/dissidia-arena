from functools import wraps

from flask import jsonify, session

from .extensions import db
from .models import User


def current_user() -> User | None:
    uid = session.get("user_id")
    # db.session.get hits SQLAlchemy's identity map after the first call per request.
    return db.session.get(User, uid) if uid else None


def login_required(view):
    @wraps(view)
    def wrapper(*args, **kwargs):
        if current_user() is None:
            return jsonify({"error": "unauthenticated"}), 401
        return view(*args, **kwargs)

    return wrapper

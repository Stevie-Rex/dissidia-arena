from functools import wraps

from flask import jsonify, session

from . import admin
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
            return jsonify({"error": "unauthenticated", "message": "sign in first"}), 401
        return view(*args, **kwargs)

    return wrapper


def _role_required(*roles: str):
    def decorator(view):
        @wraps(view)
        @login_required
        def wrapper(*args, **kwargs):
            if admin.role(current_user()) not in roles:
                return jsonify({"error": "forbidden", "message": "you don't have access to this"}), 403
            return view(*args, **kwargs)

        return wrapper

    return decorator


# The role is worked out on every request, so removing an Admin takes effect on their next one.
admin_required = _role_required("admin", "master")
master_required = _role_required("master")

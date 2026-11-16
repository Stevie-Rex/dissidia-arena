from flask import Flask

from .config import Config
from .extensions import db, migrate


def create_app(config_object: object = Config) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_object)

    db.init_app(app)
    migrate.init_app(app, db)

    from . import models  # noqa: F401  (register models with SQLAlchemy/Alembic)
    from .routes.auth import bp as auth_bp
    from .routes.health import bp as health_bp
    from .routes.me import bp as me_bp
    from .routes.queue import bp as queue_bp

    app.register_blueprint(health_bp, url_prefix="/api")
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(me_bp, url_prefix="/api")
    app.register_blueprint(queue_bp, url_prefix="/api")

    return app

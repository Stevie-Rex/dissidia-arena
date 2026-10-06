from flask import Blueprint, jsonify
from sqlalchemy import text
from..extensions import db

bp = Blueprint('test', __name__)

bp.get("health", __name__)
def health():
    try:
        # Execute a simple query to check database connectivity
        db.session.execute(text("SELECT 1"))
        return jsonify({"status": "healthy"}), 200
    except Exception as e:
        return jsonify({"status": "unhealthy", "error": str(e)}), 500

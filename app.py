from __future__ import annotations

from flask import Flask, jsonify, redirect, url_for

from modules.filecenter import filecenter_bp


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["JSON_AS_ASCII"] = False

    app.register_blueprint(filecenter_bp, url_prefix="/filecenter")

    @app.get("/")
    def index():
        return redirect(url_for("filecenter.index"))

    @app.get("/api/health")
    def health():
        return jsonify({"ok": True, "service": "G302"})

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080, debug=True)

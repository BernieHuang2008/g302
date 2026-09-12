from __future__ import annotations

import json
from pathlib import Path

from flask import Blueprint, abort, jsonify, request, send_file, send_from_directory

from .storage import ALLOWED_TAGS, get_file_path, get_file_record, load_index, save_files


MODULE_DIR = Path(__file__).resolve().parent

filecenter_bp = Blueprint("filecenter", __name__)


@filecenter_bp.get("/")
def index():
    return send_from_directory(MODULE_DIR / "static", "index.html")


@filecenter_bp.get("/static/<path:filename>")
def static_file(filename: str):
    return send_from_directory(MODULE_DIR / "static", filename)


@filecenter_bp.get("/api/files")
def files():
    return jsonify({"files": load_index(), "tags": ALLOWED_TAGS})


@filecenter_bp.post("/api/upload")
def upload():
    uploaded_files = request.files.getlist("files")
    metadata_text = request.form.get("metadata", "[]")

    try:
        metadata = json.loads(metadata_text)
    except json.JSONDecodeError:
        return jsonify({"error": "metadata 不是有效 JSON"}), 400

    if not isinstance(metadata, list):
        return jsonify({"error": "metadata 必须是数组"}), 400

    saved_items = save_files(uploaded_files, metadata)
    if not saved_items:
        return jsonify({"error": "没有收到可上传的文件"}), 400

    return jsonify({"uploaded": saved_items}), 201


@filecenter_bp.get("/api/download/<file_id>")
def download(file_id: str):
    record = get_file_record(file_id)
    if record is None:
        abort(404)

    file_path = get_file_path(record)
    if not file_path.exists():
        abort(404)

    return send_file(
        file_path,
        as_attachment=True,
        download_name=str(record.get("displayName") or record.get("originalName") or file_path.name),
    )

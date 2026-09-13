from __future__ import annotations

import json
import mimetypes
from pathlib import Path

from flask import Blueprint, abort, jsonify, request, send_file, send_from_directory

from .storage import ALLOWED_TAGS, get_file_path, get_file_record, load_index, save_files


MODULE_DIR = Path(__file__).resolve().parent
MIME_TYPES = {
    ".pdf": "application/pdf",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".pptm": "application/vnd.ms-powerpoint.presentation.macroEnabled.12",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".docm": "application/vnd.ms-word.document.macroEnabled.12",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".csv": "text/csv",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
    ".mp3": "audio/mpeg",
}

filecenter_bp = Blueprint("filecenter", __name__)


@filecenter_bp.get("/")
def index():
    return send_from_directory(MODULE_DIR / "static", "index.html")


@filecenter_bp.get("/upload")
def upload_page():
    return send_from_directory(MODULE_DIR / "static", "upload.html")


@filecenter_bp.get("/preview/<file_id>")
def preview_page(file_id: str):
    if get_file_record(file_id) is None:
        abort(404)
    return send_from_directory(MODULE_DIR / "static", "preview.html")


@filecenter_bp.get("/static/<path:filename>")
def static_file(filename: str):
    return send_from_directory(MODULE_DIR / "static", filename)


@filecenter_bp.get("/api/files")
def files():
    return jsonify({"files": load_index(), "tags": ALLOWED_TAGS})


@filecenter_bp.get("/api/files/<file_id>")
def file_details(file_id: str):
    record = get_file_record(file_id)
    if record is None:
        abort(404)
    return jsonify(record)


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


def _send_stored_file(record: dict, *, as_attachment: bool):
    file_path = get_file_path(record)
    download_name = str(record.get("displayName") or record.get("originalName") or file_path.name)
    source_name = str(record.get("originalName") or download_name)
    extension = Path(source_name).suffix.lower()
    mimetype = MIME_TYPES.get(extension) or mimetypes.guess_type(source_name)[0] or "application/octet-stream"

    return send_file(
        file_path,
        as_attachment=as_attachment,
        download_name=download_name,
        mimetype=mimetype,
    )


@filecenter_bp.get("/api/content/<file_id>")
def content(file_id: str):
    record = get_file_record(file_id)
    if record is None:
        abort(404)
    if not get_file_path(record).exists():
        abort(404)
    return _send_stored_file(record, as_attachment=False)


@filecenter_bp.get("/api/download/<file_id>")
def download(file_id: str):
    record = get_file_record(file_id)
    if record is None:
        abort(404)
    if not get_file_path(record).exists():
        abort(404)
    return _send_stored_file(record, as_attachment=True)

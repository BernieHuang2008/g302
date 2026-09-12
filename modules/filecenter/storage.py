from __future__ import annotations

import json
import os
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from werkzeug.datastructures import FileStorage


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_ROOT = Path(os.environ.get("G302_DATA_DIR", PROJECT_ROOT / "data"))
FILECENTER_ROOT = DATA_ROOT / "filecenter"
UPLOAD_ROOT = FILECENTER_ROOT / "uploads"
INDEX_FILE = FILECENTER_ROOT / "files.json"

ALLOWED_TAGS = [
    "语文",
    "数学",
    "英语",
    "物理",
    "化学",
    "生物",
    "答案",
    "课件",
    "试卷",
]

_index_lock = threading.RLock()


def ensure_storage() -> None:
    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    if not INDEX_FILE.exists():
        _write_index([])


def load_index() -> list[dict[str, Any]]:
    ensure_storage()
    with _index_lock:
        with INDEX_FILE.open("r", encoding="utf-8") as f:
            data = json.load(f)
    if not isinstance(data, list):
        return []
    return data


def _write_index(files: list[dict[str, Any]]) -> None:
    FILECENTER_ROOT.mkdir(parents=True, exist_ok=True)
    temp_path = INDEX_FILE.with_suffix(".json.tmp")
    with temp_path.open("w", encoding="utf-8") as f:
        json.dump(files, f, ensure_ascii=False, indent=2)
        f.write("\n")
    temp_path.replace(INDEX_FILE)


def save_files(files: list[FileStorage], metadata: list[dict[str, Any]]) -> list[dict[str, Any]]:
    ensure_storage()
    saved_items: list[dict[str, Any]] = []

    for index, uploaded_file in enumerate(files):
        if not uploaded_file or not uploaded_file.filename:
            continue

        item_meta = metadata[index] if index < len(metadata) and isinstance(metadata[index], dict) else {}
        original_name = Path(uploaded_file.filename).name
        display_name = str(item_meta.get("displayName") or original_name).strip() or original_name
        tags = _clean_tags(item_meta.get("tags"))

        item_id = uuid.uuid4().hex
        # The upload directory stores opaque extensionless names only.
        # The original and display names stay in the JSON index for download metadata.
        stored_name = item_id
        stored_path = UPLOAD_ROOT / stored_name
        uploaded_file.save(stored_path)

        saved_items.append(
            {
                "id": item_id,
                "displayName": display_name,
                "originalName": original_name,
                "storedName": stored_name,
                "size": stored_path.stat().st_size,
                "tags": tags,
                "uploadedAt": datetime.now(timezone.utc).isoformat(),
            }
        )

    if not saved_items:
        return []

    with _index_lock:
        current = load_index()
        current.extend(saved_items)
        current.sort(key=lambda item: item.get("uploadedAt", ""), reverse=True)
        _write_index(current)

    return saved_items


def get_file_record(file_id: str) -> dict[str, Any] | None:
    for item in load_index():
        if item.get("id") == file_id:
            return item
    return None


def get_file_path(record: dict[str, Any]) -> Path:
    return UPLOAD_ROOT / str(record["storedName"])


def _clean_tags(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    cleaned = []
    for tag in value:
        tag_text = str(tag).strip()
        if tag_text in ALLOWED_TAGS and tag_text not in cleaned:
            cleaned.append(tag_text)
    return cleaned

from __future__ import annotations

import base64
import json
import mimetypes
import os
import sys
import tempfile
from pathlib import Path
from typing import Any

from ocr_runtime import build_ocr, extract_markdown_text_from_path


def emit_message(payload: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def handle_request(raw_payload: str) -> None:
    payload = json.loads(raw_payload or "{}")
    if not isinstance(payload, dict):
        raise ValueError("Image OCR payload is malformed.")

    request_id = str(payload.get("id") or "")
    file_payload = payload.get("file") or {}
    if not isinstance(file_payload, dict):
        raise ValueError("Image OCR payload is missing file metadata.")

    data = file_payload.get("data")
    mime_type = file_payload.get("mimeType") or "image/png"
    file_name = file_payload.get("name") or "image.png"

    if not isinstance(data, str) or not data.strip():
        raise ValueError("Image OCR payload is missing base64 data.")

    suffix = Path(file_name).suffix or mimetypes.guess_extension(str(mime_type)) or ".png"
    image_bytes = base64.b64decode(data)

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(image_bytes)
            temp_path = temp_file.name

        text = extract_markdown_text_from_path(temp_path)
        emit_message({"type": "result", "id": request_id, "text": text})
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        cast_stdout = sys.stdout
        getattr(cast_stdout, "reconfigure")(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        cast_stderr = sys.stderr
        getattr(cast_stderr, "reconfigure")(encoding="utf-8")

    build_ocr()
    emit_message({"type": "ready"})

    for raw_line in sys.stdin:
        stripped_line = raw_line.strip()
        if not stripped_line:
            continue

        request_id = ""
        try:
            parsed = json.loads(stripped_line)
            if isinstance(parsed, dict):
                request_id = str(parsed.get("id") or "")

            handle_request(stripped_line)
        except Exception as error:
            emit_message({"type": "error", "id": request_id, "error": str(error)})

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        sys.stderr.write(str(error))
        raise SystemExit(1)
from __future__ import annotations

import base64
import json
import mimetypes
import os
import sys
import tempfile
from pathlib import Path
from typing import Any

from ocr_runtime import extract_markdown_text_from_path


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        cast_stdout = sys.stdout
        getattr(cast_stdout, "reconfigure")(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        cast_stderr = sys.stderr
        getattr(cast_stderr, "reconfigure")(encoding="utf-8")

    payload = json.loads(sys.stdin.read() or "{}")
    file_payload = payload.get("file") or {}
    data = file_payload.get("data")
    mime_type = file_payload.get("mimeType") or "image/png"
    file_name = file_payload.get("name") or "image.png"

    if not isinstance(data, str) or not data.strip():
        raise ValueError("Image OCR payload is missing base64 data.")

    suffix = Path(file_name).suffix or mimetypes.guess_extension(mime_type) or ".png"
    image_bytes = base64.b64decode(data)

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(image_bytes)
            temp_path = temp_file.name

        text = extract_markdown_text_from_path(temp_path)
        sys.stdout.write(json.dumps({"text": text}, ensure_ascii=False))
        return 0
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        sys.stderr.write(str(error))
        raise SystemExit(1)
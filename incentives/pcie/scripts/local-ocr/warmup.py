from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

from ocr_runtime import build_ocr, extract_markdown_text_from_path


def main() -> int:
    if os.environ.get("PCIE_PADDLEOCR_CACHE_DIR"):
        os.environ.setdefault("PADDLE_HOME", os.environ["PCIE_PADDLEOCR_CACHE_DIR"])

    build_ocr()
    temp_path: Path | None = None

    try:
        from PIL import Image, ImageDraw

        with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as temp_file:
            temp_path = Path(temp_file.name)

        image = Image.new("RGB", (280, 96), (255, 255, 255))  # type: ignore[arg-type]
        drawer = ImageDraw.Draw(image)
        drawer.text((24, 30), "OCR", fill=(0, 0, 0))
        image.save(temp_path)

        extract_markdown_text_from_path(temp_path)
    finally:
        if temp_path is not None and temp_path.exists():
            temp_path.unlink()

    print(json.dumps({"ok": True}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
# pyright: reportMissingImports=false

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any


def build_ocr():
    if os.environ.get("PCIE_PADDLEOCR_CACHE_DIR"):
        os.environ.setdefault("PADDLE_HOME", os.environ["PCIE_PADDLEOCR_CACHE_DIR"])

    from paddleocr import PaddleOCR

    return PaddleOCR(
        lang="ch",
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
    )


def _normalize_text(value: Any) -> str:
    if value is None:
        return ""

    text = str(value).strip()
    return text


def _extract_lines(value: Any) -> list[str]:
    lines: list[str] = []

    if value is None:
        return lines

    if isinstance(value, str):
        text = _normalize_text(value)
        return [text] if text else []

    if isinstance(value, dict):
        if isinstance(value.get("rec_texts"), list):
                        return [_normalize_text(item) for item in value["rec_texts"] if _normalize_text(item)]

        for key in ("res", "result", "results", "data"):
            if key in value:
                lines.extend(_extract_lines(value[key]))

        if isinstance(value.get("text"), str):
            text = _normalize_text(value["text"])
            if text:
                lines.append(text)

        return lines

    if isinstance(value, tuple):
        if (
            len(value) == 2
            and isinstance(value[1], tuple)
            and len(value[1]) >= 1
            and isinstance(value[1][0], str)
        ):
            text = _normalize_text(value[1][0])
            return [text] if text else []

        for item in value:
            lines.extend(_extract_lines(item))
        return lines

    if isinstance(value, list):
        for item in value:
            lines.extend(_extract_lines(item))
        return lines

    for attr_name in ("json", "res", "result", "results"):
        if hasattr(value, attr_name):
            try:
                lines.extend(_extract_lines(getattr(value, attr_name)))
            except Exception:
                pass

        if lines:
            return lines

    if hasattr(value, "to_json"):
        try:
            lines.extend(_extract_lines(json.loads(value.to_json())))
        except Exception:
            pass

    return lines


def extract_markdown_text_from_path(image_path: str | Path) -> str:
    image_path = str(image_path)
    ocr = build_ocr()

    prediction = None
    if hasattr(ocr, "predict"):
        prediction = ocr.predict(image_path)

    lines = _extract_lines(prediction)

    if not lines and hasattr(ocr, "ocr"):
        lines = _extract_lines(ocr.ocr(image_path, cls=False))

    text = "\n".join(line for line in lines if line).strip()
    return text or "No text detected."
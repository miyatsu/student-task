# pyright: reportMissingImports=false

from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

MAX_OCR_IMAGE_SIDE = 960


@lru_cache(maxsize=1)
def build_ocr():
    if os.environ.get("PCIE_PADDLEOCR_CACHE_DIR"):
        os.environ.setdefault("PADDLE_HOME", os.environ["PCIE_PADDLEOCR_CACHE_DIR"])

    from paddleocr import PaddleOCR

    return PaddleOCR(
        lang="ch",
        text_detection_model_name="PP-OCRv5_mobile_det",
        text_recognition_model_name="PP-OCRv5_mobile_rec",
        text_det_limit_side_len=MAX_OCR_IMAGE_SIDE,
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


def _prepare_image_for_ocr(image_path: str | Path) -> None:
    from PIL import Image

    image_path = Path(image_path)

    with Image.open(image_path) as source_image:
        largest_side = max(source_image.size)
        if largest_side <= MAX_OCR_IMAGE_SIDE:
            return

        resampling: Any = getattr(Image, "Resampling", Image)
        resample_filter = resampling.LANCZOS
        scale = MAX_OCR_IMAGE_SIDE / float(largest_side)
        target_size = (
            max(1, round(source_image.width * scale)),
            max(1, round(source_image.height * scale)),
        )
        resized_image = source_image.resize(target_size, resample_filter)

        if resized_image.mode not in ("RGB", "L"):
            resized_image = resized_image.convert("RGB")

        resized_image.save(image_path)


def extract_markdown_text_from_path(image_path: str | Path) -> str:
    image_path = str(image_path)
    _prepare_image_for_ocr(image_path)
    ocr = build_ocr()

    prediction = None
    if hasattr(ocr, "predict"):
        prediction = ocr.predict(image_path)

    lines = _extract_lines(prediction)

    if not lines and hasattr(ocr, "ocr"):
        lines = _extract_lines(ocr.ocr(image_path, cls=False))

    text = "\n".join(line for line in lines if line).strip()
    return text or "No text detected."
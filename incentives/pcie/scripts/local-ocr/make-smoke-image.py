from __future__ import annotations

from pathlib import Path


def main() -> int:
    from PIL import Image, ImageDraw

    project_root = Path(__file__).resolve().parents[2]
    output_dir = project_root / ".local" / "paddleocr"
    image_path = output_dir / "smoke-test.png"

    output_dir.mkdir(parents=True, exist_ok=True)

    image = Image.new("RGB", (280, 96), (255, 255, 255))  # type: ignore[arg-type]
    drawer = ImageDraw.Draw(image)
    drawer.text((24, 30), "OCR smoke", fill=(0, 0, 0))
    image.save(image_path)

    print(image_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
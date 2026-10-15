"""Compress locally generated horizon paintings for the WebGL stage.

Development-only: source images live in assets/source/3d-panoramas. The
browser loads the resulting WebP files directly; no Python/Node at runtime.
"""

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/source/3d-panoramas"
TARGET = ROOT / "assets/3d-panoramas"
REALMS = ("highlands", "volcano", "glacier", "citadels", "desert")


def main():
    TARGET.mkdir(parents=True, exist_ok=True)
    for realm in REALMS:
        with Image.open(SOURCE / f"{realm}.png") as original:
            image = original.convert("RGB")
            if image.width > 1800:
                image = image.resize((1800, round(image.height * 1800 / image.width)), Image.Resampling.LANCZOS)
            output = TARGET / f"{realm}.webp"
            image.save(output, format="WEBP", quality=84, method=6)
            print(f"{realm}: {image.width}x{image.height}, {output.stat().st_size} bytes")


if __name__ == "__main__":
    main()

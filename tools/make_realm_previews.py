"""Make small realm-card previews from the owner's local concept images.

Development-only helper; Pillow is not required to play the game.
"""

from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / "assets" / "realms"
SOURCES = {
    "highlands": "file_00000000c5f4820eb9cacb78eda61e2e.png",
    "citadels": "file_0000000048b4820ebb013350c2a1dd12.png",
    "glacier": "file_000000008814820e8455c514990d89fa.png",
    "volcano": "file_00000000e740820ea22a5efd59b1018c.png",
    "desert": "file_00000000f518820eb95f9aa64fc0c6ad.png",
}


def main():
    DESTINATION.mkdir(parents=True, exist_ok=True)
    for name, filename in SOURCES.items():
        with Image.open(ROOT / filename) as source:
            preview = ImageOps.fit(source.convert("RGB"), (480, 300), Image.Resampling.LANCZOS)
            path = DESTINATION / f"{name}.webp"
            preview.save(path, "WEBP", quality=84, method=6)
            print(name, path.stat().st_size)


if __name__ == "__main__":
    main()

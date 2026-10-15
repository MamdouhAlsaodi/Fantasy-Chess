"""Cut landscape wings from the five original concept images.

Development-time only: Pillow is not a browser/runtime dependency.
The side crops avoid turning the source image's flattened board into a game board.
"""

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "assets" / "terrain"
SOURCES = {
    "highlands": "file_00000000c5f4820eb9cacb78eda61e2e.png",
    "citadels": "file_0000000048b4820ebb013350c2a1dd12.png",
    "glacier": "file_000000008814820e8455c514990d89fa.png",
    "volcano": "file_00000000e740820ea22a5efd59b1018c.png",
    "desert": "file_00000000f518820eb95f9aa64fc0c6ad.png",
}


def main():
    DEST.mkdir(exist_ok=True, parents=True)
    for world, filename in SOURCES.items():
        with Image.open(ROOT / filename) as image:
            width, height = image.size
            wing = round(width * 0.23)
            for name, box in {
                "left": (0, 0, wing, height),
                "right": (width - wing, 0, width, height),
            }.items():
                path = DEST / f"{world}-{name}.webp"
                image.crop(box).convert("RGB").save(path, "WEBP", quality=84, method=6)
                print(path.name, path.stat().st_size)


if __name__ == "__main__":
    main()

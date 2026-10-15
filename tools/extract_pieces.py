"""Cut the two original 3×2 miniature contact sheets into local WebP assets.

Development-time helper only. The browser game does not need Python or Pillow.
Run with: python tools/extract_pieces.py (after installing Pillow in a temporary venv).
"""

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "assets" / "source"
OUTPUT = ROOT / "assets" / "pieces"
ORDER = ("king", "queen", "bishop", "knight", "rook", "pawn")
SHEET_NAMES = {"dawn": "dawn-contact-sheet.png", "shadow": "shadow-contact-sheet.png"}
CANVAS = 256


def transparent_cell(cell):
    """Fade near-black pixels to alpha; keep sculpture interiors opaque."""
    rgba = cell.convert("RGBA")
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            red, green, blue, _ = pixels[x, y]
            peak = max(red, green, blue)
            alpha = max(0, min(255, (peak - 7) * 255 // 23))
            pixels[x, y] = red, green, blue, alpha
    return rgba


def extract(sheet, faction):
    width, height = sheet.size
    if width % 3 or height % 2:
        raise ValueError(f"Expected a 3×2 sheet: {faction} is {sheet.size}")
    cell_width, cell_height = width // 3, height // 2
    destination = OUTPUT / faction
    destination.mkdir(parents=True, exist_ok=True)

    for index, piece in enumerate(ORDER):
        column, row = index % 3, index // 3
        cell = sheet.crop((column * cell_width, row * cell_height,
                           (column + 1) * cell_width, (row + 1) * cell_height))
        cutout = transparent_cell(cell)
        bbox = cutout.getchannel("A").getbbox()
        if bbox is None:
            raise ValueError(f"Empty cell: {faction}/{piece}")
        sculpture = cutout.crop(bbox)
        scale = min((CANVAS - 12) / sculpture.width, (CANVAS - 12) / sculpture.height)
        size = (round(sculpture.width * scale), round(sculpture.height * scale))
        sculpture = sculpture.resize(size, Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (CANVAS, CANVAS))
        canvas.alpha_composite(sculpture, ((CANVAS - size[0]) // 2, CANVAS - size[1]))
        path = destination / f"{piece}.webp"
        canvas.save(path, format="WEBP", quality=92, method=6)
        print(f"{faction}/{piece}: {size}, {path.stat().st_size} bytes")


def main():
    for faction, filename in SHEET_NAMES.items():
        source = SOURCES / filename
        if not source.is_file():
            raise FileNotFoundError(source)
        with Image.open(source) as sheet:
            extract(sheet.convert("RGB"), faction)


if __name__ == "__main__":
    main()

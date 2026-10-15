"""Create lightweight WebP tile materials from local text-generated source art.

Development-only. Run make_3d_textures.py afterward to bundle them as data
URLs for WebGL under file://. No Python or image service is used at runtime.
"""

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/source/3d-materials"
TARGET = ROOT / "assets/materials"
REALMS = ("highlands", "volcano", "glacier", "citadels", "desert")


def main():
    TARGET.mkdir(parents=True, exist_ok=True)
    for realm in REALMS:
        with Image.open(SOURCE / f"{realm}.png") as original:
            image = original.convert("RGB").resize((512, 512), Image.Resampling.LANCZOS)
            output = TARGET / f"{realm}.webp"
            image.save(output, format="WEBP", quality=80, method=6)
            print(f"{realm}: {output.stat().st_size} bytes")


if __name__ == "__main__":
    main()

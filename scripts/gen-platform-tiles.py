#!/usr/bin/env python3
"""Offline generator for the v5 platform tiles (indices 24-27).

NOT wired into npm: tiles are static and Pillow may be absent in CI. Run
manually after changing the source platform tiles:

    python3 scripts/gen-platform-tiles.py

Produces three 90deg-CW rotations of the vertical platform set plus a
composed single tile, and *additively* extends tiles.json (entries 0-23 are
left byte-identical).
"""
import json
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TILES = os.path.join(ROOT, "public", "data", "tilesets", "Dirt_Platformer_Tiles", "tiles")
MANIFEST = os.path.join(ROOT, "public", "data", "tilesets", "Dirt_Platformer_Tiles", "tiles.json")
CW = Image.Transpose.ROTATE_270  # 270 CCW == 90 CW (exact, no resampling)

# (index, name, source vertical tile) — rotate 90 CW to face the run.
ROTATIONS = [
    (24, "platform_left", "20_platform_bottom.png"),
    (25, "platform_mid_h", "12_platform_mid.png"),
    (26, "platform_right", "04_platform_top.png"),
]


def load(name):
    return Image.open(os.path.join(TILES, name)).convert("RGBA")


for _, name, src in ROTATIONS:
    load(src).transpose(CW).save(os.path.join(TILES, f"{_:02d}_{name}.png"))

# 27: left half of platform_left + right half of platform_right. Both already
# carry the top+bottom rim, so the join is rimmed on all four sides. Patch the
# seam: overlay the centre columns of platform_mid_h (homogeneous dirt, no
# caps) so the x=16 discontinuity is masked by coherent texture.
left = load("24_platform_left.png")
right = load("26_platform_right.png")
mid_h = load("25_platform_mid_h.png")
single = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
single.paste(left.crop((0, 0, 16, 32)), (0, 0))
single.paste(right.crop((16, 0, 32, 32)), (16, 0))
single.paste(mid_h.crop((13, 0, 19, 32)), (13, 0))  # 6px seam patch
single.save(os.path.join(TILES, "27_platform_single.png"))

# Additively extend tiles.json: keep 0-23 exactly, replace/append 24-27.
manifest = json.load(open(MANIFEST))
base = [t for t in manifest["tiles"] if t["index"] < 24]
assert len(base) == 24, f"expected 24 base tiles, found {len(base)}"
new = [
    {"index": 24, "row": None, "col": None, "name": "platform_left",
     "role": "terrain", "file": "tiles/24_platform_left.png"},
    {"index": 25, "row": None, "col": None, "name": "platform_mid_h",
     "role": "terrain", "file": "tiles/25_platform_mid_h.png"},
    {"index": 26, "row": None, "col": None, "name": "platform_right",
     "role": "terrain", "file": "tiles/26_platform_right.png"},
    {"index": 27, "row": None, "col": None, "name": "platform_single",
     "role": "terrain", "file": "tiles/27_platform_single.png"},
]
manifest["tiles"] = base + new
assert len(manifest["tiles"]) == 28
json.dump(manifest, open(MANIFEST, "w"), indent=2)
open(MANIFEST, "a").write("\n")
print("gen-platform-tiles: wrote 24-27, tiles.json now", len(manifest["tiles"]))

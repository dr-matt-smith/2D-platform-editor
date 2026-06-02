"""Minimal level-text parser — the Python port of src/level.js#parse, scoped
to what the planner needs.

The editor's level files are plain text: an optional header of `# key: value`
directives, then the grid rows. The planner reads only `grid`, `meta.width`,
`meta.height`, and `meta.pickupRequired`, so this port handles the directives
that affect those (`size`, `pickup-required`) and reproduces JS's grid
width/padding rule. Other directives (name, tileset, theme, viewport,
background-image) are recognised so they don't get mistaken for grid rows,
but otherwise ignored.

Parity with the JS parser's (grid, width, height, pickupRequired) is asserted
against the real level files in tests/test_level_parse.py.
"""

import re

BACKGROUND_GLYPH = "."

_DIRECTIVE = re.compile(r"^#\s*([\w-]+)\s*:\s*(.+?)\s*$")
_SIZE = re.compile(r"^(\d+)\s*x\s*(\d+)$", re.IGNORECASE)


def _is_comment(line):
    return line.lstrip().startswith("//")


def parse(text):
    """Parse level text into {"meta", "grid", "rows"}.

    meta carries width, height, declared ({"w","h"} | None), and
    pickupRequired ('all' | 0 | positive int). grid rows are right-padded
    with the background glyph to a common width.
    """
    lines = re.sub(r"\r\n?", "\n", str(text)).split("\n")

    meta = {
        "name": None,
        "theme": "sky",
        "width": 0,
        "height": 0,
        "declared": None,
        "pickupRequired": "all",
    }
    raw_rows = []  # {"text", "line"}
    in_grid = False

    for i, line in enumerate(lines):
        if _is_comment(line):
            continue

        if not in_grid:
            m = _DIRECTIVE.match(line)
            if m:
                # A grid row of walls ("####") never matches key:value, so
                # directives stay unambiguous inside the header region.
                key = m.group(1).lower()
                value = m.group(2)
                if key == "name":
                    meta["name"] = value
                elif key == "size":
                    s = _SIZE.match(value)
                    if s:
                        meta["declared"] = {"w": int(s.group(1)), "h": int(s.group(2))}
                elif key in ("pickup-required", "pickuprequired"):
                    trimmed = value.strip().lower()
                    if trimmed == "all":
                        meta["pickupRequired"] = "all"
                    elif re.match(r"^\d+$", trimmed):
                        meta["pickupRequired"] = int(trimmed)
                # name/tileset/theme/viewport/background-image: recognised,
                # not needed by the planner — skip.
                continue
            in_grid = True  # first non-comment, non-directive line starts the grid
        raw_rows.append({"text": line, "line": i + 1})

    width = meta["declared"]["w"] if meta["declared"] else max((len(r["text"]) for r in raw_rows), default=0)

    grid = [
        r["text"] if len(r["text"]) >= width else r["text"] + BACKGROUND_GLYPH * (width - len(r["text"]))
        for r in raw_rows
    ]

    meta["width"] = width
    meta["height"] = len(raw_rows)
    return {"meta": meta, "grid": grid, "rows": raw_rows}

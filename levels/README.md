# Levels

Two example levels in the v1 text format (see `TDDs/1_design/version01_design.md` §4),
authored from the tileset screenshots in
`public/assets/tilesets/Dirt_Platformer_Tiles/screenshots/`.

| File | Source screenshot | Idea |
|------|-------------------|------|
| `above_ground.txt` | `above_ground.png` | Night-sky platformer: dirt ground, rising pillars, spike pits, collectibles. |
| `below_ground.txt` | `below_ground.png` | Solid-dirt cave: carved tunnels/rooms forming a maze to the exit. |

Glyphs: `.` empty · `#` dirt/wall · `P` spawn (exactly one) · `E` exit ·
`^` hazard · `o` collectible. Moon/stars/grass/drips are tileset *decoration*,
not gameplay glyphs — the renderer adds them based on the `# theme:` header
(`sky` default vs. `cave`). `below_ground.txt` sets `# theme: cave` for a dark
dirt background with no celestial decor; `above_ground.txt` uses the default
night sky. The renderer autotiles `#` from the 9-slice block, so edges and
corners are picked automatically.

Both pass the project validator (`one P`, declared size, no undefined glyphs)
with zero errors. v1 has no reachability lint and no runtime, so traversability
is by-inspection only.

To try one: `npm run dev`, then paste a file's contents into the editor.

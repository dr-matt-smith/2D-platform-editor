# Levels

Two example levels in the v1 text format (see `TDDs/1_design/version01_design.md` §4),
authored from the tileset screenshots in
`public/assets/tilesets/Dirt_Platformer_Tiles/screenshots/`.

| File | Source screenshot | Idea |
|------|-------------------|------|
| `above_ground.txt` | `above_ground.png` | Night-sky platformer: dirt ground, rising pillars, spike pits, collectibles. |
| `below_ground.txt` | `below_ground.png` | Solid-dirt cave: carved tunnels/rooms forming a maze to the exit. |

Glyphs: `.` empty · `#` dirt/wall · `P` spawn (exactly one) · `E` exit ·
`^` hazard · `o` collectible. Moon/stars/grass are tileset *decoration*, not
gameplay glyphs — they belong to renderer theming, not the grid.

Both pass the project validator (`one P`, declared size, no undefined glyphs)
with zero errors. v1 has no reachability lint and no runtime, so traversability
is by-inspection only.

To try one: `npm run dev`, then paste a file's contents into the editor.

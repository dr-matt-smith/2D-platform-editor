# Vendored playtest engine — attribution

The code under `src/play/` powers the editor's **Playtest** mode. It
was **vendored from**
[`dr-matt-smith/simple-platformer-1`](https://github.com/dr-matt-smith/simple-platformer-1)
at commit `4c3b936` ("Rename project to drop kaplay/Bean
association"). The upstream project is **© 2026 Matt Smith
(dr-matt-smith)** and licensed **CC BY 4.0** — full text in
[`./LICENSE`](./LICENSE) in this directory and at
<https://creativecommons.org/licenses/by/4.0/legalcode>.

## What's vendored

- **`core/` + `entities/` + `constants.js` + `logger.js`** — the
  swept-AABB platformer engine: `Game`/`Scene`/`Input`/`AssetLoader`,
  `Player` (gravity + single jump + swept-y collision),
  `Platform`/`Coin`/`Spike` entities, the AABB primitives. Vendored
  byte-identical to upstream except the four documented forks (see
  [`README.md`](./README.md) and `TDDs/1_design/version09_design.md`
  §7). Licensed under the CC BY 4.0 carried in `./LICENSE`.

- **`AssetLoader.synth('coin')` recipe** — the Web-Audio oscillator
  envelope used for the coin pickup sound. Original to the upstream
  project, vendored verbatim in `core/assets.js`. No audio file is
  bundled (the recipe is the asset).

## What's *not* vendored (anymore)

v9 vendored three PNG sprites (`player.png`, `coin.png`, `spike.png`)
under `public/play-assets/` so the playtest could draw the player +
entities. **v14** made the editor renderer the single source of pixel
truth for both editor preview and playtest. **v15** removed the
sprites + the launcher's loading machinery; they hadn't been drawn
since v14 merged.

If a future version reintroduces a default sprite pack for tilesets
that don't authorise entity art, it will reintroduce its own
attribution path; the CC BY 4.0 licence in this directory applies to
the engine code regardless.

## Attribution checklist for re-distribution

If you redistribute `src/play/` (or any subset), the CC BY 4.0
conditions are satisfied by carrying:

- this `sources.md` (or equivalent attribution + licence reference);
- the neighbouring `LICENSE` (CC BY 4.0 full text + copyright
  notice);
- the in-product credit line shown by the playtest overlay
  (*"Mechanic: simple-platformer-1 @4c3b936 · CC BY 4.0"*).

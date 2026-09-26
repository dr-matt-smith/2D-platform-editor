# Adapted engine code — attribution

Part of this package — the game loop, scene base class, keyboard input,
AABB collision, the player/platform/coin/spike entities, the tuning
constants and the coin sound recipe — is **adapted from**
[`dr-matt-smith/simple-platformer-1`](https://github.com/dr-matt-smith/simple-platformer-1)
at commit `4c3b936` ("Rename project to drop kaplay/Bean association").
The upstream project is **© 2026 Matt Smith (dr-matt-smith)** and licensed
**CC BY 4.0** — full text in [`./LICENSE`](./LICENSE) in this directory and
at <https://creativecommons.org/licenses/by/4.0/legalcode>.

## What was adapted, and how

The code was first vendored unchanged apart from a few small fixes. It has
since been **restructured** into one class per file with enums and
interfaces (see [`README.md`](./README.md) for a file-by-file account):

- `src/Game.ts`, `src/Scene.ts`, `src/KeyboardInput.ts`, `src/Aabb.ts`
  (with `Box.ts` and `Axis.ts`), `src/SoundBank.ts`, `src/Entity.ts`,
  `src/Player.ts`, `src/Platform.ts`, `src/Coin.ts`, `src/Spike.ts` and
  `src/constants.ts` derive from upstream's `core/`, `entities/` and
  constants modules, and their header comments say so.
- The upstream logger was removed.
- The physics arithmetic (movement, gravity, collision, time step) is
  unchanged, operation for operation.
- **`SoundBank`'s coin recipe** — the Web Audio oscillator envelope played
  on a pickup — is the upstream recipe. No audio file is bundled (the
  recipe is the asset).

Changes are licensed under the same CC BY 4.0 terms.

## What is not from upstream

`Goal`, `World`, `PlaytestScene`, `PlaytestGate`, `PlaytestCamera`,
`Playtest`, `ScriptedInput`, `JsPhysicsAdapter` and the enums and
interfaces they use are original to this project.

No artwork is vendored: the playtest draws with the level's tileset through
the render package (earlier versions carried three upstream PNG sprites;
they were removed once the shared renderer took over).

## Attribution checklist for re-distribution

If you redistribute this package (or any subset of the adapted files), the
CC BY 4.0 conditions are satisfied by carrying:

- this `sources.md` (or equivalent attribution, with a note that the code
  was modified, and a licence reference);
- the neighbouring `LICENSE` (CC BY 4.0 full text + copyright notice).

The project's root `README.md` also credits simple-platformer-1.

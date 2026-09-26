# errors to fix





# Wishlist

Working list of features + bugs the user has flagged. Items move to
a versioned design doc once scoped; ticked items are removed once
shipped (see `TDDs/3_transcripts/` for the as-shipped record).

Sources of CC0 free game assets:
- https://github.com/madjin/awesome-cc0
- https://www.hackingtons.com/free-game-art.html
- https://github.com/GDQuest/game-sprites
- 


- [] add a LOAD button
  - where user can paste in text for a level, and a new level will be created and stored in local memory


## v24 candidates — concrete carry-overs / small fixes

- [ ] **fix slight delay between pickup touch and pickup sound**
  - in Play / Test mode, when the character touches a pickup it
    disappears immediately but the collect sound fires a beat later
  - investigate the audio-play path: `assets.play(...)` call site
    vs the score++ increment; suspect one extra frame of latency

- [ ] **`tutorial.txt` solves end-to-end** (v22 → v23 carry-over)
  - v23 M6's action-graph extensions (`drop_release`, `run_off`)
    shipped but tutorial.txt still reports "Exit unreachable from
    spawn"
  - v23 trajectory probe diagnosed this as LEVEL-GEOMETRY, not an
    action-graph gap: peak jump = 4.9 cells; row-2 exit sits 6 rows
    above bottom floor; row-4 ooo platform's jumps clip the row-0
    ceiling and fall back
  - Two fix paths:
    - **a)** edit `tutorial.txt` — add an intermediate row-3 or row-2
      stepping stone bridging the ooo platform (cols 6–11) to the
      exit platform (cols 18–22)
    - **b)** engine extension: introduce a double-jump (one
      in-air `vy = -JUMP_FORCE` press allowed) or wall-climb.
      Would break v9 §7 byte-identical-to-upstream invariant —
      significant architectural decision, needs explicit user
      approval

- [ ] **`below_ground.txt` solves** (v22 → v23 carry-over)
  - dies at frame 49; suspected hazard-touch during spawn-fall or
    early walk
  - re-investigate after the new action types are in (may share
    root cause with tutorial.txt)

- [ ] **`precision_landing` edge rule** (v23 carry-over)
  - the third item from v23's action-graph plan that didn't ship:
    accept edges where an action's trajectory passes within ±2 px
    of a 1-tile target's cell centre, even if the cell-resolved
    end position differs
  - needed for cherry-on-pillar (1-tile-wide platforms) — v22
    tower-cherry only worked because that pillar was 3 wide

- [ ] **multi-coloured path overlay** for multi-solution display
  - when ≥ 3 solutions in the agent dialog, paint each in a
    distinct hue on the overlay simultaneously (currently:
    focused-one only)

- [ ] **`prefers-color-scheme` first-load theme default**
  - if the user hasn't set `v23.theme` yet, read
    `window.matchMedia('(prefers-color-scheme: light)')` and seed
    the initial state accordingly

## v25 candidates


- [ ] build in a top row for every level
  - dark grey background, light grey text
  - for SCORE  / messages about goto exit / and so on
  - (at present such run-time messages appear over the top row of tiles we might was the player to visit)
  - player's character can jump up / fall down in front of this messages row
    - everything in the messages row is decoration/background - it does not interact with the player's character


## Long-standing candidates

- [ ] **viewport guide follows the mouse** — drag-to-pan the
  v23 dashed-rect to preview a different focus cell

- [ ] **author-resizable legend width** (v22 right-side layout)
  - currently fixed at 220 px

- [ ] **drag-and-drop legend reorder** — change role-group order

- [ ] **per-tileset legend customisation persistence**
  - remember collapsed state / layout per tileset, not globally

- [ ] **minimap**
  - perhaps in Play Settings: map only shows parts the player has
    already visited
  - so the player has to BUILD their map by exploring

- [ ] **in edit mode, resize the level**
  - larger and smaller
  - especially important now that scrolling viewports work

- [ ] **link levels together (doors / tunnels)**
  - since scrolling is permitted, doors connecting one level to
    another
  - and perhaps tunnels (vertical pipes a la Mario)

- [ ] **update all existing tilesets for the new JSON structure**
  - some legacy tilesets still need the v22.1 `imageLocked` field
  - can you help me identify alternative pickups, decoration, etc.
    in different tilesets

- [ ] **sloping tiles** — new physics required


## Runtime / level-options ideas

- [ ] **multi-exit levels** — a `# single-exit: true/false` flag
  - if multi-exit, any exit cell completes the level
  - if single-exit, the level declares which one

- [ ] **1-way platform colliders**
  - jump up through them, then land on them on the way down
  - per-tile flag in the tileset schema


## AI / agent direction ideas

- [ ] **reverse the mechanic — adversarial level design (Lemmings-AI)**
  - the player designs a level; multiple AI agents try to complete it
  - goal: last as long as possible before ANY / MOST / ALL agents win
  - narrative — slowing down bad guys chasing your team
  - level design IS the game (a la Lemmings, but the lemmings are AI)

- [ ] **path / polygon hints to the user**
  - e.g. tutorial mode — show the agent's path overlay during
    practice levels
  - several "training" levels that you help the user get through

- [ ] **AI agent rates DIFFICULTY / FUN / CHALLENGE / PLAYABILITY**
  - composite score from solution stats (steps, jumps, replans)
  - coloured routes (climbing-wall style) — harder if certain
    colour-coded blocks/handholds can't be used

- [ ] **AI level designer** — agent generates levels at a target
  difficulty, validated by the testing agent solving them

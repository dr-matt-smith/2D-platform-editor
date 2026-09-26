# Code documentation

One page per class, interface and enum, grouped by package. Start with
[README_architecture.md](../README_architecture.md) for how the packages fit
together; each package's section below links to its class pages.

<!-- Each package section is filled in as that package is restructured. -->

## Packages

- [level-format](level-format/README.md) — the level text format
- [render](render/README.md) — tilesets and the canvas renderer
- [engine](engine/README.md) — the game
- [agent](agent/README.md) — the planning agent

## Apps

- [editor](editor/README.md)
- [player](player/README.md)
- [agent-cli](agent-cli/README.md)

---

## Object-oriented conventions

The code is written to demonstrate object-oriented TypeScript. These are the
rules every package follows.

### What becomes what

| Kind | Use it for | Example |
|---|---|---|
| **class** | Anything with identity or state, or a cohesive set of behaviour over one concept | `Level`, `Tileset`, `Player`, `NavGraph` |
| **abstract class** | A family of classes sharing structure, where the base is never used on its own | `Scene`, `Entity`, `Planner` |
| **interface** | A contract between parts — what a caller needs, not how it is done | `PhysicsAdapter`, `InputSource`, `KeyValueStore` |
| **enum** (string-valued) | A fixed set of named values | `Role`, `Severity`, `GamePhase`, `ActionKind` |
| **type alias** | Plain data shapes, unions, function types | `Cell`, `Recording` |
| **static method** | Stateless helpers that belong to a concept | `Level.parse(text)`, `Rect.overlaps(a, b)` |
| **free function** | Only where a class would be artificial (tiny pure utilities) | `escapeHtml()` |

### Rules

- **Encapsulation.** Fields are `private` (or `protected` for subclasses) unless
  they are part of the public contract; expose state through methods or
  `get` accessors. Mark anything that never changes `readonly`.
- **Access modifiers are explicit.** Use TypeScript's `private` / `protected` /
  `readonly` keywords (clearer to read than `#private`); omit `public`
  except where it helps readability.
- **Enums are string enums** whose values match the data formats
  (e.g. `Role.Terrain = 'terrain'` — the same string that appears in
  `tile_lookup.json`), so saved data never changes.
- **Constructors stay simple.** Anything that parses, fetches or can fail
  is a static factory (`Level.parse(text)`, `Tileset.load(id)`).
- **Composition over inheritance.** Inherit only for true "is-a" families
  (`Player extends Entity`); otherwise hold a collaborator
  (`Editor` has a `LevelLibrary`).
- **Depend on interfaces.** A class that needs I/O takes it through an
  interface in its constructor (dependency injection), so tests can pass a fake.
- **One class per file** for anything non-trivial; the file is named after the
  class (`Level.ts`, `NavGraph.ts`). Each package's `src/index.ts` exports
  its public API.
- **Behaviour is unchanged.** The restructure never changes what the program
  does: unit tests, end-to-end tests and the golden parity vectors
  (`deno task gen:golden` must produce an identical file) prove it.

### Class page template

Each page in `docs/<package>/` follows this shape:

```markdown
# ClassName

`packages/<pkg>/src/ClassName.ts` · class | abstract class | interface | enum

One or two sentences: what it represents and why it exists.

## Relationships
- extends / implements / is used by / owns (with links to the other pages)

## Members
| Member | Kind | Description |
|---|---|---|
| `parse(text)` | static method | … |

## Example
(short usage snippet)

## Design notes
Why it is shaped this way — the OO idea it demonstrates.
```

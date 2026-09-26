# LevelLibrary

`apps/editor/src/LevelLibrary.ts` · class

The editor's level library: the bundled levels (from the manifest), a draft
per level saved in storage, and levels pasted in by the user ("local"
levels, which live only in storage). It also remembers the text last loaded
or saved — the *baseline* — which is what "unsaved changes" means.

## Relationships
- takes its I/O through [LevelLibraryIO](LevelLibraryIO.md): a `LevelFetch` and a [KeyValueStore](KeyValueStore.md)
- reads [LevelManifestEntry](LevelManifestEntry.md)s and [TilesetManifestEntry](TilesetManifestEntry.md)s;
  stores [LocalLevelEntry](LocalLevelEntry.md)s; lists [LevelListItem](LevelListItem.md)s
- builds URLs with [ContentPaths](ContentPaths.md)
- used by [EditorApp](EditorApp.md), [LevelMenu](LevelMenu.md), [TilesetMenu](TilesetMenu.md) and [LevelDialog](LevelDialog.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `new LevelLibrary(io)` | constructor | |
| `isLocalId(id)` | static method | Whether `id` is a pasted level (`local-…`) |
| `init()` | async method | Fetch the manifest (rejects if it cannot), and migrate a first-version buffer once |
| `list()` | method | Bundled levels (flagged `modified` if they have a draft), then local ones |
| `load(id)` | async method | The draft, else the bundled text; becomes the baseline |
| `peek(id)` | async method | Like `load`, without moving the baseline |
| `save(id, text)` | method | Store a draft; becomes the baseline |
| `revert(id)` | async method | Drop the draft and return the bundled text (a local level keeps its text) |
| `isDirty(text)` | method | Whether `text` differs from the baseline |
| `lastOpen()` / `setLastOpen(id)` | methods | The level open last time |
| `addLocal(text, name?)` / `removeLocal(id)` | methods | Add or remove a pasted level |
| `tilesets()` | async method | The tilesets manifest, fetched once (`[]` offline) |

Storage keys (unchanged): `ld:v3:draft:<id>`, `ld:v3:lastOpen`,
`ld:v3:migrated`, `ld:v24:locals`, and the legacy `leveldesigner:v1`.

## Example
```ts
const library = new LevelLibrary({ fetch: (url) => fetch(url), storage: BrowserStorage.withFallback() });
await library.init();
const text = await library.load('tutorial');
library.isDirty(text + '#'); // true

// In a test:
const fake = new LevelLibrary({ fetch: fakeFetch, storage: new MemoryStore() });
```

## Design notes
- **Dependency injection.** All fetching and storage goes through the
  injected interfaces, so the tests run headless with fakes and check the
  exact keys written.
- **Constructor stores, `init` loads.** Construction cannot fail; the
  network is touched only by the async methods.
- **Encapsulation.** The manifest, the baseline and the tileset cache are
  private; callers ask questions (`isDirty`, `list`) instead of reading
  them.

# ContentStore

`apps/agent-cli/src/ContentStore.ts` · class

A content folder on disk (`levels/` and `tilesets/`, like `content/data`): finds levels by id or path, and loads the legend of a level's tileset exactly as the editor does. Every file is read through an injected [FileReader](FileReader.md).

## Relationships
- holds a [FileReader](FileReader.md) (default [DenoFileReader](DenoFileReader.md))
- returns [ManifestEntry](ManifestEntry.md), [LevelFile](LevelFile.md), [LoadedLegend](LoadedLegend.md) and [PreparedLevel](PreparedLevel.md)
- throws [InputError](InputError.md) for a missing or unreadable level or manifest
- uses level-format's `Level.parse` and `Legend.fromLookup`
- made by [AgentCommand](AgentCommand.md)`.store()`

## Members
| Member | Kind | Description |
|---|---|---|
| `new ContentStore(contentDir, files?)` | constructor | The folder, and how to read files |
| `contentDir` | readonly property | The folder holding `levels/` and `tilesets/` |
| `readManifest()` | async method | The bundled levels, in manifest order. `InputError` if missing or malformed |
| `loadBundled(entry)` | async method | Read a manifest entry's level file |
| `resolve(ref)` | async method | A `.txt` or slash-containing `ref` is a path; anything else is a manifest id |
| `loadLegend(tilesetId)` | async method | The legend from `tilesets/<id>/tile_lookup.json`, or `Legend.DEFAULT` with a warning |
| `prepare(file)` | async method | Parse the level and load the legend of its `# tileset:` |

## Example
```ts
const store = new ContentStore('content/data');
const level = await store.prepare(await store.resolve('tutorial'));
level.parsed.meta.tileset;   // 'Dirt_Platformer_Tiles'

// In a test: files from a table, no disk.
const fake = new ContentStore('c', { readTextFile: (p) => Promise.resolve(files[p]) });
```

## Design notes
- **Dependency injection.** The store needs only "read this text file", so
  that is all [FileReader](FileReader.md) offers. Tests pass a small fake
  class and can even check which paths were read.
- **Errors with meaning.** Low-level failures (`Deno.errors.NotFound`, a
  permission error) become an [InputError](InputError.md) with a message
  the user can act on, so no caller has to know about Deno's error types.
- **Encapsulation.** Path rules (`looksLikePath`) and manifest validation
  are private static helpers: callers ask for a level, not for a path.

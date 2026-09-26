# LevelCatalog

`apps/player/src/LevelCatalog.ts` · class

The bundled levels: the list from `data/levels/manifest.json`, grouped for the picker, and the text of each level on demand.

## Relationships
- holds [LevelEntry](LevelEntry.md)s and an injected `LevelFetch` (see [LevelFetchResponse](LevelFetchResponse.md))
- makes [LevelGroup](LevelGroup.md)s for the [LevelPicker](LevelPicker.md)
- loaded for [PlayerApp](PlayerApp.md) by `main.ts`

## Members
| Member | Kind | Description |
|---|---|---|
| `new LevelCatalog(levels, fetch, base)` | constructor | A catalog over a known list (tests use this directly) |
| `load(fetch, base)` | static async method | Fetch the manifest under the site base URL; rejects if it is missing |
| `parseManifest(json)` | static method | Keep well-formed rows (name defaults to id); `[]` for a non-array |
| `levels` | readonly property | The entries, in manifest order |
| `find(id)` | method | The entry with that id, or `undefined` |
| `groups()` | method | Runs of consecutive levels with the same group (`null` = ungrouped) |
| `pick(requested)` | method | The requested id if it exists, else the first level, else `null` |
| `loadText(entry)` | async method | Fetch a level's text; rejects if missing |

## Example
```ts
const catalog = await LevelCatalog.load(fetch, import.meta.env.BASE_URL);
const id = catalog.pick(url.requested());
const text = await catalog.loadText(catalog.find(id!)!);
```

## Design notes
- **Static factory.** Loading fetches and can fail, so it is `load`; the
  constructor just stores, which also lets tests build a catalog from a list.
- **Dependency injection.** Fetch and base URL are passed in, so the
  catalog runs under `deno test` with a table of fake files.
- **A real-world gotcha.** The browser's `fetch` throws "Illegal invocation"
  if called as a method of another object, so `loadText` calls the stored
  function unbound (and a test checks it).
- **Forgiving parsing.** A bad manifest row is skipped rather than breaking
  the page.

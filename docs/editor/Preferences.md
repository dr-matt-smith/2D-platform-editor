# Preferences

`apps/editor/src/Preferences.ts` · class

The editor's saved settings, typed. Each setting is a `get`/`set` accessor
over one storage key. Preferences are best-effort: if storage throws, a
read gives the default and a write is dropped.

## Relationships
- stores through a [KeyValueStore](KeyValueStore.md) ([BrowserStorage](BrowserStorage.md) in the app)
- uses [LegendLayout](LegendLayout.md) and [EditorTheme](EditorTheme.md)
- read and written by [PreviewPane](PreviewPane.md), [LegendPanel](LegendPanel.md),
  [ThemeController](ThemeController.md) and [AgentDialog](AgentDialog.md)

## Members
| Member | Kind | Key | Default |
|---|---|---|---|
| `legendLayout` | get/set accessor | `v22.legendLayout` | `LegendLayout.Right` |
| `legendCollapsed` | get/set accessor | `v22.legendCollapsed` | `false` |
| `fitToScreen` | get/set accessor | `v22.fitToScreen` | `false` |
| `theme` | get/set accessor | `v23.theme` | `null` (follow the OS) |
| `dialogMinimised` | get/set accessor | `v23.dialogMinimised` | `false` |

## Example
```ts
const prefs = new Preferences(new BrowserStorage());
prefs.fitToScreen = !prefs.fitToScreen;   // saved as 'true' / 'false'
if (prefs.legendLayout === LegendLayout.Bottom) { /* … */ }
```

## Design notes
- **Accessors hide the encoding.** Callers see booleans and enums; the
  strings in storage (the same ones the editor has always written) are a
  private detail.
- **Enums validate.** An unrecognised stored value reads as the default.
- **Dependency injection.** Tests pass a [MemoryStore](MemoryStore.md), or a
  store that throws.

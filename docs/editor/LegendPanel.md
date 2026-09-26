# LegendPanel

`apps/editor/src/LegendPanel.ts` · class

The legend (`#legend`): the active tileset's glyphs grouped by role, each a
button that picks the glyph the fill tool paints with. A small toolbar
minimises the panel or moves it between the right of the preview and below
it (both saved). When the tileset declares background images, a menu sets
the level's `# background-image:`.

## Relationships
- reads glyphs, thumbnails and images from [ActiveTileset](ActiveTileset.md)
- saves its layout in [Preferences](Preferences.md) as a [LegendLayout](LegendLayout.md)
- reports to a [LegendPanelEvents](LegendPanelEvents.md) (the [EditorApp](EditorApp.md))
- its `glyph` is read by [DragFillTool](DragFillTool.md) through its host

## Members
| Member | Kind | Description |
|---|---|---|
| `new LegendPanel(element, pane, tilesets, prefs, events)` | constructor | Read the saved layout and listen for clicks and menu changes |
| `glyph` | get accessor | The active glyph (starts as `#`) |
| `applyLayout()` | method | Set the pane's `layout-right` / `layout-bottom` / `legend-collapsed` classes |
| `render()` | method | Rebuild the panel's HTML |

## Example
```ts
const legend = new LegendPanel(view.legend, view.rightPane, tilesets, prefs, {
  backgroundImage: () => Level.parse(source.text).meta.backgroundImage ?? '',
  onBackgroundImage: (id) => setBackground(id),
  onLayoutChange: () => preview.applyFit(),
});
legend.applyLayout();
legend.render();
```

## Design notes
- **Groups by role, not character.** Glyphs are grouped by their level-format
  `Role`, so a tileset can use any characters.
- **Small private builders.** `render` reads as a list of parts
  (toolbar, background menu, role groups, decorations), each a private
  method returning HTML.
- **Callbacks for what it cannot know.** The panel never parses level text;
  it asks its host for the current background image and reports choices.

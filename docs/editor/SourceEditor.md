# SourceEditor

`apps/editor/src/SourceEditor.ts` · class

The level text editor: the `#src` textarea, its line-number gutter and its
column ruler. It owns the text and reports changes twice — at once, and
again when typing pauses — so the expensive parse-and-draw runs once per
pause rather than per keystroke.

## Relationships
- reports to a [SourceEditorEvents](SourceEditorEvents.md) (implemented by [EditorApp](EditorApp.md))

## Members
| Member | Kind | Description |
|---|---|---|
| `DEBOUNCE_MS` | static readonly | `120` — the pause that counts as "typing settled" |
| `MIN_RULER_COLS` | static readonly | `40` — the ruler's minimum width |
| `new SourceEditor(textarea, gutter, ruler, events)` | constructor | Measure the character width (`--cw`) and listen for input and scrolling |
| `text` | get/set accessor | The level text. Setting it does not fire the events |
| `showLines(text)` | method | Redraw the gutter and ruler for `text` |
| `gutterText(lineCount)` | static method | `"1\n2\n…"` |
| `rulerText(cols)` | static method | `'|'` every 10 columns, `'+'` every 5, `'·'` between |

## Example
```ts
const source = new SourceEditor(textarea, gutter, ruler, {
  onInput: () => markDirty(),
  onSettle: () => reparse(),
});
source.text = '#####\n#P.E#\n#####';
```

## Design notes
- **Debounce inside the component.** Callers see two meaningful events,
  not raw key presses; the timer is a private detail.
- **Pure helpers are static.** The gutter and ruler strings are computed
  by static methods, which the unit tests call directly.
- **Encapsulation.** The textarea is private; the rest of the editor reads
  and writes `text`, so it never depends on it being a textarea.

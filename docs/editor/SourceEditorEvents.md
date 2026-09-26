# SourceEditorEvents

`apps/editor/src/SourceEditor.ts` · interface

What a [SourceEditor](SourceEditor.md) reports to its owner.

## Relationships
- passed to [SourceEditor](SourceEditor.md); implemented by [EditorApp](EditorApp.md) with an object literal

## Members
| Member | Kind | Description |
|---|---|---|
| `onInput()` | method | Every keystroke |
| `onSettle()` | method | Typing has paused for `SourceEditor.DEBOUNCE_MS` |

## Example
```ts
new SourceEditor(textarea, gutter, ruler, {
  onInput: () => toolbar.showDirty(library.isDirty(source.text)),
  onSettle: () => { history.push(source.text); void refresh(); },
});
```

## Design notes
A typed callback interface keeps the component independent of whoever owns
it: SourceEditor knows *that* something listens, not *what*.

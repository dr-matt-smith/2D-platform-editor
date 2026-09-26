# LevelFile

`apps/editor/src/LevelFile.ts` · class

A level ready to save as a `.txt` file the user can drop into
`content/data/levels/`.

## Relationships
- created by [EditorApp](EditorApp.md)`.downloadLevel`

## Members
| Member | Kind | Description |
|---|---|---|
| `from(id, text)` | static method | Filename `<id>.txt` made safe (`level.txt` without an id); trailing newlines removed |
| `filename`, `content` | readonly properties | |
| `download(doc?)` | method | Save it through a temporary download link |

## Example
```ts
LevelFile.from('a b/c', 'text\n\n'); // { filename: 'a_b_c.txt', content: 'text' }
LevelFile.from(currentId, source.text).download();
```

## Design notes
Private constructor and a static factory: every `LevelFile` has already
been cleaned. Building it is pure (unit-tested); only `download` touches the
page. Trailing newlines are stripped because the parser reads one as an
extra empty row.

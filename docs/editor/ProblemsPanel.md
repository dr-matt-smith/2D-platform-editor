# ProblemsPanel

`apps/editor/src/ProblemsPanel.ts` · class

The message bar under the editor (`#problems`): one line summarising the
level's issues, tinted by severity through its `data-severity` attribute.

## Relationships
- summarises with [IssueSummary](IssueSummary.md)
- used by [EditorApp](EditorApp.md) on every repaint and by
  [PlayModeController](PlayModeController.md) when Play is refused

## Members
| Member | Kind | Description |
|---|---|---|
| `new ProblemsPanel(element)` | constructor | |
| `show(issues)` | method | Show the summary of `issues` ("OK" when there are none) |
| `flash()` | method | Replay the flash animation, to draw the eye |

## Example
```ts
problems.show(level.validate(legend));
```

## Design notes
A thin view over a pure model: the wording and ordering rules are in
[IssueSummary](IssueSummary.md), which is unit-tested.

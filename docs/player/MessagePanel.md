# MessagePanel

`apps/player/src/MessagePanel.ts` · class

The message panel over the stage (`#message`): a heading and a few lines saying what the page is doing or what went wrong.

## Relationships
- owned by [PlayerView](PlayerView.md); used by [PlayerApp](PlayerApp.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `new MessagePanel(element)` | constructor | The element to manage |
| `show(title, lines?)` | method | A heading with optional paragraphs |
| `showList(title, items)` | method | A heading with a bulleted list (the launch-gate reasons) |
| `describeIssue(issue)` | static method | "Line 3, column 7: unknown glyph 'Q'"; whole-level issues are at line 1, column 1 |

## Example
```ts
panel.show('Paused', ['Choose a level, then press Enter or Space to play.']);
panel.showList('“Tutorial” can\'t be played yet', reasons.map(MessagePanel.describeIssue));
```

## Design notes
- **Two methods, not a flag.** `show` and `showList` replace a boolean
  `asList` parameter, so each call says what it does.
- **Static helper.** `describeIssue` needs no panel, only an issue, so it
  is static and unit-tested without a DOM.

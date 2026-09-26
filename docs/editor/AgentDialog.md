# AgentDialog

`apps/editor/src/AgentDialog.ts` · class

The Test dialog. It opens straight into a search with a live countdown, then
shows the result: the solutions (focus one, Demo it, read its trace; the
view can be minimised to a thin bar) or why none was found, with buttons
to search again for 10, 15 or 20 seconds. Closing aborts a running search.

## Relationships
- extends [ModalDialog](ModalDialog.md), overriding `close` and `opened`
- draws each state with [AgentDialogMarkup](AgentDialogMarkup.md)
- configured by [AgentDialogOptions](AgentDialogOptions.md) (its `RunAgent` does the searching)
- saves the minimised choice in [Preferences](Preferences.md)
- opened by [AgentController](AgentController.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `INITIAL_BUDGET_MS` | static readonly | `5000` |
| `new AgentDialog(options)` | constructor | Read the saved minimised choice |
| `render()` | protected method | Nothing: each state renders itself as the search runs |
| `opened()` | protected method | Start the first search |
| `dismiss()` | protected method | `close()` |
| `close()` | protected method | Abort the search, stop the countdown, remove the dialog, call `onClose` |

## Example
```ts
new AgentDialog({
  prefs,
  runAgent: (ms, onProgress, signal) => tester.test(level, legend.toRecord(), tileset, { maxRuntimeMs: ms, onProgress, signal }),
  onResult: (result) => paintPaths(result),
  onDemo: (recording) => playMode.start(recording),
}).open();
```

## Design notes
- **Overriding and extending.** `close` does its own clean-up and then calls
  `super.close()`, so the base class still removes the backdrop and the key
  listener.
- **Behaviour here, markup elsewhere.** This class handles the search, the
  timer and the buttons (`data-act`); the HTML of each state is in
  [AgentDialogMarkup](AgentDialogMarkup.md), which is pure and tested.
- **Cancellation.** The search takes an `AbortSignal`; closing mid-search
  aborts it and ignores its late result.

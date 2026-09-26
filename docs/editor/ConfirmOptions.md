# ConfirmOptions

`apps/editor/src/ConfirmDialog.ts` · interface

What a [ConfirmDialog](ConfirmDialog.md) needs.

## Relationships
- passed to [ConfirmDialog](ConfirmDialog.md); holds [ConfirmAction](ConfirmAction.md)s

## Members
| Member | Kind | Description |
|---|---|---|
| `message` | property | The question (escaped) |
| `actions` | property | Buttons, left to right; the last is "cancel" |
| `onChoice(value)` | property | Called with the chosen value after the dialog closes |

## Example
See [ConfirmDialog](ConfirmDialog.md).

## Design notes
An options object keeps the constructor to one argument and the call site
self-describing.

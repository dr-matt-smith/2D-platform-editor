# ConfirmAction

`apps/editor/src/ConfirmDialog.ts` · interface

One button of a [ConfirmDialog](ConfirmDialog.md).

## Relationships
- listed in [ConfirmOptions](ConfirmOptions.md)`.actions`

## Members
| Member | Kind | Description |
|---|---|---|
| `label` | property | Button text |
| `value` | property | What choosing it reports (type `T`) |
| `primary` | optional property | Style as the main action |

## Example
```ts
{ label: 'Cancel', value: 'cancel' }
```

## Design notes
Generic in `T` along with the dialog.

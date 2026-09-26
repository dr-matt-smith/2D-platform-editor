# StartStatus

`apps/player/src/StartStatus.ts` · enum

What happened when [PlaySession](PlaySession.md) tried to start a level. It tags the `StartResult` union (same folder, `StartResult.ts`): `{ status: Playing } | { status: Invalid; reasons } | { status: Cancelled }`.

## Relationships
- returned (in a `StartResult`) by [PlaySession](PlaySession.md)`.start()`; read by [PlayerApp](PlayerApp.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `Playing` = `'playing'` | enum member | The game is running |
| `Invalid` = `'invalid'` | enum member | The launch gate refused the level; `reasons` says why |
| `Cancelled` = `'cancelled'` | enum member | Stopped, or overtaken by a newer start, before it could launch |

## Example
```ts
const result = await session.start(loadText);
if (result.status === StartStatus.Invalid) show(result.reasons);
```

## Design notes
An enum as the tag of a discriminated union: checking `status` narrows the result, so only the `Invalid` case has `reasons`.

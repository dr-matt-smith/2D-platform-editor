# OverlaySolution

`apps/editor/src/SolutionOverlay.ts` · interface

The part of an agent `Solution` that [SolutionOverlay](SolutionOverlay.md)
paints: the plan's trace (each step's target cell and kind), its layout
(the start cell) and its goals in visit order.

## Relationships
- read by [SolutionOverlay](SolutionOverlay.md); the agent package's `Solution` satisfies it

## Members
| Member | Kind | Description |
|---|---|---|
| `plan` | optional property | `{ trace, graph, goals? }`, or null (nothing is painted) |

## Example
```ts
const stub: OverlaySolution = {
  plan: { graph: { start: { r: 2, c: 2 } } as LevelLayout, goals: ['2,8'], trace: [/* … */] },
};
```

## Design notes
Asking for the minimum shape (not the whole `Solution` class) lets the
end-to-end spec and the unit tests paint hand-made solutions.

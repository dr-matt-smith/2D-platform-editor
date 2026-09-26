# SimulatorRunOptions

`packages/agent/src/Simulator.ts` · interface

Options for [Simulator](Simulator.md)`.run`.

## Relationships
- taken by [Simulator](Simulator.md)`.run`

## Members
| Member | Kind | Description |
|---|---|---|
| `tileset?` | property | Passed to the adapter's `makeScene` |
| `dt?` | property | Seconds per frame (default 1/60) |
| `maxFrames?` | property | Frame budget (default 600) |

## Example
```ts
simulator.run(level, legend, recording, { maxFrames: 2400 });
```

## Design notes
Everything optional has a documented default on the class.

# LaunchOptions

`packages/engine/src/LaunchOptions.ts` · interface

Optional settings for [Playtest](Playtest.md)`.launch`.

## Relationships
- passed to [Playtest](Playtest.md)`.launch`
- `recording` is a list of [RecordingEvent](RecordingEvent.md)s

## Members
| Member | Kind | Description |
|---|---|---|
| `recording?` | property | Demo mode: replay this instead of reading the keyboard |

## Example
```ts
Playtest.launch(level, legend, tileset, canvas, { recording: plan.recording });
```

## Design notes
An options object keeps the common call short and gives each setting a name.

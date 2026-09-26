# DenoFileReader

`apps/agent-cli/src/DenoFileReader.ts` · class

The real [FileReader](FileReader.md): reads through Deno's file system (the `solve` task runs with `--allow-read`).

## Relationships
- implements [FileReader](FileReader.md)
- the default for [ContentStore](ContentStore.md); passed in by `main.ts`

## Members
| Member | Kind | Description |
|---|---|---|
| `readTextFile(path)` | method | `Deno.readTextFile(path)` |

## Example
```ts
const text = await new DenoFileReader().readTextFile('content/data/levels/tutorial.txt');
```

## Design notes
The production half of dependency injection: a one-line adapter from the
[FileReader](FileReader.md) interface to the platform. Keeping it this thin
means everything interesting is testable without it.

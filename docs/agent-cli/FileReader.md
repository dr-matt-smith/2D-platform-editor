# FileReader

`apps/agent-cli/src/FileReader.ts` · interface

Reads a text file. The CLI only ever reads, so this is all the file system it needs. A missing file rejects with `Deno.errors.NotFound`, as `Deno.readTextFile` does.

## Relationships
- implemented by [DenoFileReader](DenoFileReader.md) and by test fakes
- held by [ContentStore](ContentStore.md); part of [CommandContext](CommandContext.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `readTextFile(path)` | method | `Promise<string>` |

## Example
```ts
const files: FileReader = {
  readTextFile: (path) => path in table ? Promise.resolve(table[path]) : Promise.reject(new Deno.errors.NotFound(path)),
};
```

## Design notes
Interface segregation: a narrow contract (one method) is easy to fake and
says exactly what the store depends on.

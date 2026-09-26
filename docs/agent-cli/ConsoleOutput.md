# ConsoleOutput

`apps/agent-cli/src/ConsoleOutput.ts` · class

The real [Output](Output.md): reports to stdout with `console.log`, errors to stderr with `console.error`.

## Relationships
- implements [Output](Output.md)
- the default `io` of `main.ts`'s `run`

## Members
| Member | Kind | Description |
|---|---|---|
| `out(text)` | method | Print to stdout |
| `err(text)` | method | Print to stderr |

## Example
```ts
run(Deno.args, new ConsoleOutput());
```

## Design notes
Like [DenoFileReader](DenoFileReader.md), a thin adapter to the platform so
that commands depend on the [Output](Output.md) interface, and tests can
collect output in arrays instead.

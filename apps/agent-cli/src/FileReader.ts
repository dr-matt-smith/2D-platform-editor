// Reads a text file. The CLI only ever reads, so this is all the file
// system it needs. Rejects with `Deno.errors.NotFound` for a missing file,
// as `Deno.readTextFile` does.
export interface FileReader {
  readTextFile(path: string): Promise<string>;
}

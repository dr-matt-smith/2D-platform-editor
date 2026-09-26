import type { FileReader } from './FileReader.ts';

// The real FileReader: Deno's file system (needs --allow-read).
export class DenoFileReader implements FileReader {
  readTextFile(path: string): Promise<string> {
    return Deno.readTextFile(path);
  }
}

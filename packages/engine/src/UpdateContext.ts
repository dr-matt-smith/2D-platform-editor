import type { Box } from './Box.ts';
import type { InputSource } from './InputSource.ts';

// What an entity may read while it updates: the keys, and the solid boxes
// it must not pass through.
export interface UpdateContext {
  input: InputSource;
  solids: readonly Box[];
}

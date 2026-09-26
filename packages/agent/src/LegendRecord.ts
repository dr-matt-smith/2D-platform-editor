/** One glyph's legend entry; the agent reads only its `role`. */
export interface LegendRecordEntry {
  role?: string | null;
}

/**
 * A glyph legend as a plain record (level-format's `Legend.toRecord()`).
 * The agent takes the record rather than the `Legend` class because it
 * never imports level-format.
 */
export type LegendRecord = { readonly [glyph: string]: LegendRecordEntry | undefined };

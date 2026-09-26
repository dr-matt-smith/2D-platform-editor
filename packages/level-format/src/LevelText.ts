import { Level } from './Level.ts';
import { PickupRequirement } from './PickupRequirement.ts';
import type { PickupRequired } from './PickupRequirement.ts';
import type { Dimensions } from './LevelData.ts';

// The raw text of a level, as the author typed it, with methods that set
// or remove one header directive while leaving every other line (other
// directives, comments, the grid, the author's formatting) untouched.
// `Level.serialize()` would rewrite the whole text; the editor uses this
// class instead so a menu change never reformats the buffer.
//
// Immutable: every setter returns a new `LevelText`.
//
//   const text = new LevelText(buffer).setTileset('Neon_Set').setViewport({ w: 20, h: 10 });
//   buffer = text.toString();
export class LevelText {
  // A header line: `# key:` (keys may contain `-`).
  private static readonly HEADER_LINE = /^#\s*\w[\w-]*\s*:/;
  // The header test `setTileset` has always used; it does not accept `-`
  // in keys, so a new tileset line goes before e.g. `# background-image:`.
  // Kept separate so the tileset menu's edits stay exactly as they were.
  private static readonly TILESET_HEADER_LINE = /^#\s*\w+\s*:/;

  constructor(readonly text: string) {}

  // Set `# tileset:`; choosing the default tileset removes the line,
  // matching `Level.serialize`, which only writes non-default values.
  setTileset(id: string, defaultId: string = Level.DEFAULT_TILESET): LevelText {
    const line = id === defaultId ? null : `# tileset: ${id}`;
    return this.withDirective('tileset', line, LevelText.TILESET_HEADER_LINE);
  }

  // Set `# background-image:`; null or '' removes it (no image).
  setBackgroundImage(id: string | null | undefined): LevelText {
    return this.withDirective('background-image', id ? `# background-image: ${id}` : null);
  }

  // Set `# viewport:`; null or 'fit' removes it (show the whole world).
  // Sizes are clamped to [Level.VIEWPORT_MIN, Level.VIEWPORT_MAX].
  setViewport(value: Dimensions | 'fit' | null | undefined): LevelText {
    const isSize = value != null && typeof value === 'object' && 'w' in value && 'h' in value;
    const line = isSize
      ? `# viewport: ${Level.clampViewport(value.w)}x${Level.clampViewport(value.h)}`
      : null;
    return this.withDirective('viewport', line);
  }

  // Set `# pickup-required:`; 'all' (the default), null, or anything that
  // is not a whole number >= 0 removes it.
  setPickupRequired(value: PickupRequired | null | undefined): LevelText {
    const payload = new PickupRequirement(value ?? 'all').directiveValue();
    return this.withDirective('pickup-required', payload === null ? null : `# pickup-required: ${payload}`);
  }

  // Parse the text into a `Level`.
  parse(): Level {
    return Level.parse(this.text);
  }

  toString(): string {
    return this.text;
  }

  // Replace the `# key:` line with `line`, or remove it when `line` is
  // null. A new line goes at the end of the header: after the leading
  // run of directives and `//` comments, before the first grid row.
  private withDirective(
    key: string,
    line: string | null,
    headerLine: RegExp = LevelText.HEADER_LINE,
  ): LevelText {
    const lines = this.text.split('\n');
    const existing = new RegExp(`^#\\s*${key}\\s*:`, 'i');
    const idx = lines.findIndex((l) => existing.test(l));
    if (line === null) {
      if (idx >= 0) lines.splice(idx, 1);
    } else if (idx >= 0) {
      lines[idx] = line;
    } else {
      let at = 0;
      while (at < lines.length && (headerLine.test(lines[at]) || Level.isComment(lines[at]))) at++;
      lines.splice(at, 0, line);
    }
    return new LevelText(lines.join('\n'));
  }
}

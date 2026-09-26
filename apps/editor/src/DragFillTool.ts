import { Level, Rect } from '@2d-platform/level-format';
import type { GridCell } from './PreviewGeometry.ts';
import type { PreviewPane } from './PreviewPane.ts';

// What the fill tool needs from the editor.
export interface DragFillHost {
  // The glyph to paint with (the legend's active glyph).
  glyph(): string;
  // The current level text.
  text(): string;
  // Commit edited text as one undoable step.
  commit(text: string): void;
}

// The rectangle tool: drag on the preview to fill the cells under the
// marquee with the active glyph (hold Shift for just the outline).
// A drag that starts in the HUD band is ignored.
export class DragFillTool {
  private dragStart: GridCell | null = null;

  constructor(private readonly preview: PreviewPane, private readonly host: DragFillHost) {
    const overlay = preview.overlay;
    overlay.addEventListener('pointerdown', (e) => this.onDown(e));
    overlay.addEventListener('pointermove', (e) => {
      if (this.dragStart) preview.showMarquee(this.dragStart, this.cellAt(e));
    });
    overlay.addEventListener('pointerup', (e) => this.onUp(e));
    overlay.addEventListener('pointercancel', () => {
      this.dragStart = null;
      preview.clearOverlay();
    });
  }

  // `text` with the rectangle a–b filled (or outlined) with `glyph`, or
  // null when the level has no grid. Each changed grid row is written back
  // on its original line, so the header and any `//` comments survive.
  static apply(text: string, a: GridCell, b: GridCell, glyph: string, outline: boolean): string | null {
    const level = Level.parse(text);
    if (!level.grid.length) return null;
    const rect = new Rect(a.cx, a.cy, b.cx, b.cy);
    const grid = outline ? rect.outline(level.grid, glyph) : rect.fill(level.grid, glyph);
    const lines = text.split('\n');
    level.rows.forEach((row, i) => {
      lines[row.line - 1] = grid[i];
    });
    return lines.join('\n');
  }

  private cellAt(e: MouseEvent): GridCell {
    const { overlay } = this.preview;
    return this.preview.geometry.cellAt(
      e.clientX,
      e.clientY,
      overlay.getBoundingClientRect(),
      overlay.width,
      overlay.height,
    );
  }

  private onDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    const cell = this.cellAt(e);
    if (cell.inHud) return; // the HUD band is not part of the level
    this.dragStart = cell;
    this.preview.overlay.setPointerCapture(e.pointerId);
    this.preview.showMarquee(cell, cell);
  }

  private onUp(e: PointerEvent): void {
    if (!this.dragStart) return;
    const start = this.dragStart;
    this.dragStart = null;
    this.preview.clearOverlay();
    const text = DragFillTool.apply(this.host.text(), start, this.cellAt(e), this.host.glyph(), e.shiftKey);
    if (text !== null) this.host.commit(text);
  }
}

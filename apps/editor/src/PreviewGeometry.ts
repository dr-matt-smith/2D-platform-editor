import type { LevelData } from '@2d-platform/level-format';

// A grid cell under the pointer. `inHud` is true when the pointer is in
// the HUD band above the level (the cell is then clamped to row 0).
export interface GridCell {
  cx: number;
  cy: number;
  inHud: boolean;
}

// A rectangle in canvas pixels.
export interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// The CSS size the canvas keeps during Play, before any Fit scaling.
export interface PlayPin {
  cssW: number;
  cssH: number;
}

// Where things are on the preview canvas. The canvas is `tile` pixels per
// cell with a HUD band `hudHeight` pixels tall across the top, so every
// conversion between pointer, cell and pixel adds or removes that band.
// Pure arithmetic (no DOM), so the hit-testing is unit-tested.
export class PreviewGeometry {
  constructor(readonly tile: number, readonly hudHeight: number) {}

  // The cell under a pointer at (clientX, clientY), for a canvas whose
  // on-screen box is `box` and whose drawing size is width × height. The
  // canvas may be CSS-scaled (Fit mode), so the pointer is first mapped
  // back to canvas pixels. Cells are clamped to the level.
  cellAt(
    clientX: number,
    clientY: number,
    box: { left: number; top: number; width: number; height: number },
    width: number,
    height: number,
  ): GridCell {
    const gx = ((clientX - box.left) * (width / box.width)) / this.tile;
    const gyPx = (clientY - box.top) * (height / box.height) - this.hudHeight;
    const gy = gyPx / this.tile;
    const cols = Math.max(1, Math.round(width / this.tile));
    const rows = Math.max(1, Math.round((height - this.hudHeight) / this.tile));
    return {
      cx: Math.max(0, Math.min(cols - 1, Math.floor(gx))),
      cy: Math.max(0, Math.min(rows - 1, Math.floor(gy))),
      inHud: gyPx < 0,
    };
  }

  // The pixel rectangle covering the cells between corners a and b.
  cellRect(a: GridCell, b: GridCell): PixelRect {
    const x0 = Math.min(a.cx, b.cx);
    const x1 = Math.max(a.cx, b.cx);
    const y0 = Math.min(a.cy, b.cy);
    const y1 = Math.max(a.cy, b.cy);
    return {
      x: x0 * this.tile,
      y: y0 * this.tile + this.hudHeight,
      w: (x1 - x0 + 1) * this.tile,
      h: (y1 - y0 + 1) * this.tile,
    };
  }

  // Where the Play camera will start for a level with `# viewport: WxH`:
  // a WxH window centred on the player spawn (or the middle of the
  // world), clamped inside the world. Null when there is no viewport.
  viewportRect(level: LevelData): PixelRect | null {
    const vp = level.meta.viewport;
    if (!vp) return null;
    let focusCol = Math.floor(level.meta.width / 2);
    let focusRow = Math.floor(level.meta.height / 2);
    const spawnRow = level.grid.findIndex((row) => row.includes('P'));
    if (spawnRow >= 0) {
      focusRow = spawnRow;
      focusCol = level.grid[spawnRow].indexOf('P');
    }
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    const t = this.tile;
    return {
      x: clamp((focusCol - vp.w / 2) * t, 0, Math.max(0, level.meta.width - vp.w) * t),
      y: clamp((focusRow - vp.h / 2) * t, 0, Math.max(0, level.meta.height - vp.h) * t) + this.hudHeight,
      w: vp.w * t,
      h: vp.h * t,
    };
  }

  // The canvas's CSS size during Play: the viewport (or whole world) at
  // the editor's tile size, plus the HUD band. The engine draws smaller
  // tiles, so without this pin the canvas would shrink on entering Play.
  playPin(level: LevelData): PlayPin {
    const cols = level.meta.viewport?.w ?? level.meta.width;
    const rows = level.meta.viewport?.h ?? level.meta.height;
    return { cssW: cols * this.tile, cssH: rows * this.tile + this.hudHeight };
  }

  // Scale factor that fits a w × h box inside an avail box, keeping its
  // aspect ratio.
  static fitScale(availW: number, availH: number, w: number, h: number): number {
    return Math.min(availW / w, availH / h);
  }
}

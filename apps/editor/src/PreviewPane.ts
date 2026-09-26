import type { Level } from '@2d-platform/level-format';
import { LevelRenderer } from '@2d-platform/render';
import type { Tileset } from '@2d-platform/render';
import type { Preferences } from './Preferences.ts';
import { PreviewGeometry } from './PreviewGeometry.ts';
import type { GridCell, PlayPin } from './PreviewGeometry.ts';
import { SolutionOverlay } from './SolutionOverlay.ts';

// The level preview: the `#preview` canvas the level is drawn on, and the
// `#overlay` canvas stacked over it for the drag marquee, the viewport
// guide and the agent's solution paths.
//
// It also owns Fit mode (scale the canvas to fill its pane, via CSS). In
// edit mode the canvas is fitted from its drawing size; during Play the
// engine owns the canvas, so it is fitted from a pinned size instead
// (see `enterPlay`).
export class PreviewPane {
  // Canvas pixels per cell in the editor (the engine uses its own size).
  static readonly TILE = 24;
  // The HUD band across the top of the canvas, in canvas pixels.
  static readonly HUD_HEIGHT = LevelRenderer.HUD_HEIGHT_TILES * PreviewPane.TILE;
  // Shown in the HUD band while editing, so nobody tries to paint there.
  static readonly HUD_PLACEHOLDER = 'HUD: score / status';
  // `.canvas-wrap` padding (12px each side), excluded from the fit.
  private static readonly WRAP_PADDING = 24;
  private static readonly RESIZE_DEBOUNCE_MS = 50;
  private static readonly GUIDE_COLOUR = 'rgba(255, 220, 100, 0.9)';

  readonly geometry = new PreviewGeometry(PreviewPane.TILE, PreviewPane.HUD_HEIGHT);
  private readonly ctx: CanvasRenderingContext2D;
  private readonly octx: CanvasRenderingContext2D;
  private fit: boolean;
  // Set while Play or Demo runs.
  private playPin: PlayPin | null = null;
  private resizeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly overlay: HTMLCanvasElement,
    private readonly wrap: HTMLElement,
    private readonly prefs: Preferences,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.octx = overlay.getContext('2d')!;
    this.fit = prefs.fitToScreen;
    // Re-fit when the window settles on a new size (clientWidth/Height
    // exclude scrollbars, so this cannot feed back on itself).
    window.addEventListener('resize', () => {
      if (this.resizeTimer) clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => {
        this.refit();
        this.resizeTimer = null;
      }, PreviewPane.RESIZE_DEBOUNCE_MS);
    });
  }

  // Fit mode on or off (saved as a preference). Call `refit` to apply.
  get fitToScreen(): boolean {
    return this.fit;
  }
  set fitToScreen(on: boolean) {
    this.fit = on;
    this.prefs.fitToScreen = on;
  }

  // Draw `level` in edit mode: the level, the HUD placeholder, then a
  // fresh overlay (matched to the canvas size) with the viewport guide.
  draw(level: Level, tileset: Tileset | null): void {
    const renderer = new LevelRenderer(tileset, PreviewPane.TILE);
    renderer.draw(this.ctx, level);
    renderer.drawHud(this.ctx, PreviewPane.HUD_PLACEHOLDER);

    if (this.overlay.width !== this.canvas.width) this.overlay.width = this.canvas.width;
    if (this.overlay.height !== this.canvas.height) this.overlay.height = this.canvas.height;
    this.clearOverlay();
    this.drawViewportGuide(level);
    // The level's size may have changed, and with it the fit.
    this.applyFit();
  }

  clearOverlay(): void {
    this.octx.clearRect(0, 0, this.overlay.width, this.overlay.height);
  }

  // Highlight the cells between corners a and b (the drag-to-fill marquee).
  showMarquee(a: GridCell, b: GridCell): void {
    const r = this.geometry.cellRect(a, b);
    this.clearOverlay();
    this.octx.fillStyle = 'rgba(255,255,255,0.18)';
    this.octx.fillRect(r.x, r.y, r.w, r.h);
    this.octx.strokeStyle = 'rgba(255,255,255,0.9)';
    this.octx.lineWidth = 2;
    this.octx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  }

  // A painter for solution paths on the overlay, below the HUD band.
  solutionOverlay(): SolutionOverlay {
    return new SolutionOverlay(this.octx, PreviewPane.TILE, PreviewPane.HUD_HEIGHT);
  }

  // Edit mode: size the canvas (and overlay, so pointer maths stays
  // right) to fill the pane when Fit is on, or clear the sizing when off.
  applyFit(): void {
    if (this.playPin) return; // Play owns the canvas size
    if (!this.fit) {
      this.setCssSize(this.canvas, '', '');
      this.setCssSize(this.overlay, '', '');
      return;
    }
    const avail = this.available();
    if (!avail) return;
    const { width, height } = this.canvas;
    if (width <= 0 || height <= 0) return;
    const scale = PreviewGeometry.fitScale(avail.w, avail.h, width, height);
    const cssW = `${Math.floor(width * scale)}px`;
    const cssH = `${Math.floor(height * scale)}px`;
    this.setCssSize(this.canvas, cssW, cssH);
    this.setCssSize(this.overlay, cssW, cssH);
  }

  // Play mode: show the canvas at its pinned size, scaled up to fill the
  // pane when Fit is on.
  applyPlayFit(): void {
    if (!this.playPin) return;
    const { cssW, cssH } = this.playPin;
    if (!this.fit) {
      this.setCssSize(this.canvas, `${cssW}px`, `${cssH}px`);
      return;
    }
    const avail = this.available();
    if (!avail) return;
    const scale = PreviewGeometry.fitScale(avail.w, avail.h, cssW, cssH);
    this.setCssSize(this.canvas, `${Math.floor(cssW * scale)}px`, `${Math.floor(cssH * scale)}px`);
  }

  // Apply whichever fit the current mode needs.
  refit(): void {
    this.applyFit();
    this.applyPlayFit();
  }

  // Play is starting: from now on the canvas is fitted from `pin`.
  enterPlay(pin: PlayPin): void {
    this.playPin = pin;
  }

  // Play has ended: release the pinned size so the next draw sizes the
  // canvas from the level again.
  leavePlay(): void {
    this.setCssSize(this.canvas, '', '');
    this.playPin = null;
  }

  // The space inside `.canvas-wrap`, or null if it has none yet.
  private available(): { w: number; h: number } | null {
    const w = this.wrap.clientWidth - PreviewPane.WRAP_PADDING;
    const h = this.wrap.clientHeight - PreviewPane.WRAP_PADDING;
    return w > 0 && h > 0 ? { w, h } : null;
  }

  private setCssSize(el: HTMLElement, width: string, height: string): void {
    el.style.width = width;
    el.style.height = height;
  }

  // A dashed rectangle where the Play camera will start, for levels with
  // a `# viewport:` (inset 1px so the stroke sits inside the cells).
  private drawViewportGuide(level: Level): void {
    const r = this.geometry.viewportRect(level);
    if (!r) return;
    this.octx.save();
    this.octx.setLineDash([6, 4]);
    this.octx.strokeStyle = PreviewPane.GUIDE_COLOUR;
    this.octx.lineWidth = 2;
    this.octx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
    this.octx.restore();
  }
}

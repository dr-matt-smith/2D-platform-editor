import type { KeyValueStore } from './KeyValueStore.ts';
import { Splitter } from './Splitter.ts';
import type { SplitterOptions } from './Splitter.ts';

// The horizontal bar (`#splitterH`) above the message bar. Dragging
// upwards grows the bar by setting `--problems-h` in pixels. With nothing
// saved the property stays unset, so the stylesheet's default height
// applies.
export class ProblemsSplitter extends Splitter {
  static readonly STORAGE_KEY = 'ld:v13:problemsH';
  static readonly MIN_PROBLEMS = 60;
  static readonly MIN_EDITOR = 240;
  // The bar's own height, reserved so it never eats into the editor's minimum.
  static readonly BAR_PX = 6;

  private constructor(doc: Document, win: Window, bar: HTMLElement, store: KeyValueStore) {
    super(doc, win, bar, store, ProblemsSplitter.STORAGE_KEY);
  }

  // Wire the page's `#splitterH`; null when it is not in the page.
  static attach(options: SplitterOptions = {}): ProblemsSplitter | null {
    const { doc, win, storage } = Splitter.resolve(options);
    const bar = doc.querySelector<HTMLElement>('#splitterH');
    if (!bar) return null;
    return new ProblemsSplitter(doc, win, bar, storage).listen();
  }

  private clamp(px: number): number {
    return Splitter.clampPx(
      px,
      ProblemsSplitter.MIN_PROBLEMS,
      ProblemsSplitter.MIN_EDITOR + ProblemsSplitter.BAR_PX,
      this.win.innerHeight,
    );
  }

  protected restore(): void {
    const raw = this.savedSize();
    const px = raw != null ? Number(raw) : NaN;
    if (Number.isFinite(px)) this.applySize(this.clamp(px));
  }

  // The height is the distance from the pointer to the bottom of the window.
  protected sizeAt(e: PointerEvent): number {
    return this.clamp(this.win.innerHeight - e.clientY);
  }

  protected applySize(px: number): void {
    this.doc.documentElement.style.setProperty('--problems-h', `${px}px`);
  }

  protected measure(): number | null {
    const panel = this.doc.querySelector('.problems');
    return panel ? Math.round(panel.getBoundingClientRect().height) : null;
  }

  // Remove the property (not set a pixel value), so the stylesheet's
  // relative default applies again.
  protected resetSize(): void {
    this.doc.documentElement.style.removeProperty('--problems-h');
  }
}

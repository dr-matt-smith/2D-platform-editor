import type { KeyValueStore } from './KeyValueStore.ts';
import { Splitter } from './Splitter.ts';
import type { SplitterOptions } from './Splitter.ts';

// The vertical bar (`#splitter`) between the text pane and the preview.
// Dragging sets `--left-pct` (the text pane's width) in pixels.
export class PaneSplitter extends Splitter {
  static readonly STORAGE_KEY = 'ld:v12:splitter';
  static readonly MIN_LEFT = 220;
  static readonly MIN_RIGHT = 220;

  private constructor(doc: Document, win: Window, bar: HTMLElement, store: KeyValueStore) {
    super(doc, win, bar, store, PaneSplitter.STORAGE_KEY);
  }

  // Wire the page's `#splitter`; null when it is not in the page.
  static attach(options: SplitterOptions = {}): PaneSplitter | null {
    const { doc, win, storage } = Splitter.resolve(options);
    const bar = doc.querySelector<HTMLElement>('#splitter');
    if (!bar) return null;
    return new PaneSplitter(doc, win, bar, storage).listen();
  }

  // The pane width to start with: the saved width, else half the
  // viewport; always clamped. `storageKey` lets the same rule read
  // another splitter's key.
  static loadInitial(
    storage: KeyValueStore | null | undefined,
    viewportW: number,
    minLeft = PaneSplitter.MIN_LEFT,
    minRight = PaneSplitter.MIN_RIGHT,
    storageKey = PaneSplitter.STORAGE_KEY,
  ): number {
    let raw: string | null | undefined = null;
    try {
      raw = storage?.getItem(storageKey);
    } catch { /* private mode etc. → null */ }
    const parsed = raw != null ? Number(raw) : NaN;
    const seed = Number.isFinite(parsed) ? parsed : Math.round((Number(viewportW) || 0) / 2);
    return Splitter.clampPx(seed, minLeft, minRight, viewportW);
  }

  protected restore(): void {
    this.applySize(PaneSplitter.loadInitial(this.store, this.win.innerWidth));
  }

  protected sizeAt(e: PointerEvent): number {
    return Splitter.clampPx(e.clientX, PaneSplitter.MIN_LEFT, PaneSplitter.MIN_RIGHT, this.win.innerWidth);
  }

  protected applySize(px: number): void {
    this.doc.documentElement.style.setProperty('--left-pct', `${px}px`);
  }

  protected measure(): number | null {
    const pane = this.doc.querySelector('.pane.left');
    return pane ? Math.round(pane.getBoundingClientRect().width) : null;
  }

  // Back to half and half — as a percentage, so it stays half when the
  // window is later resized.
  protected resetSize(): void {
    this.doc.documentElement.style.setProperty('--left-pct', '50%');
  }
}

import { BrowserStorage } from './BrowserStorage.ts';
import type { KeyValueStore } from './KeyValueStore.ts';

// Where a splitter lives; each defaults to the real page.
export interface SplitterOptions {
  doc?: Document;
  win?: Window;
  storage?: KeyValueStore;
}

// A draggable bar that resizes part of the page. Dragging sets a CSS
// custom property on the document root (which the stylesheet reads);
// releasing saves the size; double-clicking resets it.
//
// The drag itself is the same for every splitter, so it is written once
// here. Subclasses supply the parts that differ — which axis, which CSS
// property, what "reset" means — by overriding the abstract hooks: the
// template method pattern.
export abstract class Splitter {
  private dragging = false;
  private pointerId: number | null = null;

  protected constructor(
    protected readonly doc: Document,
    protected readonly win: Window,
    protected readonly bar: HTMLElement,
    protected readonly store: KeyValueStore,
    protected readonly storageKey: string,
  ) {}

  // Clamp a desired size in pixels so neither side drops below its
  // minimum. When `viewport` cannot fit both minimums, `minLeft` wins
  // (for the panes, the text editor is the primary surface).
  static clampPx(px: unknown, minLeft: number, minRight: number, viewport: unknown = 0): number {
    const safeViewport = Math.max(0, Number(viewport) || 0);
    const ceiling = safeViewport - minRight;
    if (ceiling < minLeft) return minLeft; // viewport too narrow for both mins
    const v = Number(px);
    if (!Number.isFinite(v)) return minLeft;
    return Math.max(minLeft, Math.min(ceiling, Math.round(v)));
  }

  // Resolve the options against the real page.
  protected static resolve(options: SplitterOptions): Required<SplitterOptions> {
    return {
      doc: options.doc ?? document,
      win: options.win ?? window,
      storage: options.storage ?? BrowserStorage.withFallback(),
    };
  }

  // Apply the saved (or default) size.
  protected abstract restore(): void;
  // The size to show while the pointer is at `e`.
  protected abstract sizeAt(e: PointerEvent): number;
  // Set the size, in pixels.
  protected abstract applySize(px: number): void;
  // The size as rendered, to save when a drag ends (null: nothing to save).
  protected abstract measure(): number | null;
  // Undo any saved size (the storage entry is already removed).
  protected abstract resetSize(): void;

  // Apply the initial size and start listening. Called once by the
  // subclass factories; calling it twice would stack listeners.
  protected listen(): this {
    this.restore();
    this.bar.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.bar.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.bar.addEventListener('pointerup', (e) => this.onPointerUp(e));
    this.bar.addEventListener('pointercancel', (e) => this.onPointerUp(e));
    this.bar.addEventListener('dblclick', () => this.onDoubleClick());
    return this;
  }

  // The saved size; null if absent or storage refuses.
  protected savedSize(): string | null {
    try {
      return this.store.getItem(this.storageKey);
    } catch {
      return null;
    }
  }

  private onPointerDown(e: PointerEvent): void {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    this.dragging = true;
    this.pointerId = e.pointerId;
    this.bar.classList.add('dragging');
    try { this.bar.setPointerCapture(e.pointerId); } catch { /* ok */ }
    e.preventDefault();
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.dragging) return;
    this.applySize(this.sizeAt(e));
  }

  private onPointerUp(e: PointerEvent): void {
    if (!this.dragging) return;
    this.dragging = false;
    this.bar.classList.remove('dragging');
    try { this.bar.releasePointerCapture(this.pointerId!); } catch { /* ok */ }
    this.pointerId = null;
    // Save the rendered size, never a stale clamp.
    const size = this.measure();
    if (size !== null) {
      try { this.store.setItem(this.storageKey, String(size)); } catch { /* ok */ }
    }
    e.preventDefault();
  }

  private onDoubleClick(): void {
    try { this.store.removeItem(this.storageKey); } catch { /* ok */ }
    this.resetSize();
  }
}

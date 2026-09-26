// What the source editor reports to its owner.
export interface SourceEditorEvents {
  // Every keystroke (the text has changed but may still be changing).
  onInput(): void;
  // Typing has paused for DEBOUNCE_MS: time for the expensive work.
  onSettle(): void;
}

// The level text editor: the `#src` textarea, its line-number gutter and
// its column ruler. It owns the text and tells its owner when the text
// changes — at once (`onInput`) and again once typing pauses (`onSettle`),
// so the preview is not re-parsed on every keystroke.
export class SourceEditor {
  static readonly DEBOUNCE_MS = 120;
  // The ruler is at least this wide, so short levels still get a scale.
  static readonly MIN_RULER_COLS = 40;

  private settleTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly textarea: HTMLTextAreaElement,
    private readonly gutter: HTMLElement,
    private readonly ruler: HTMLElement,
    private readonly events: SourceEditorEvents,
  ) {
    // Line the ruler and the stylesheet's guide columns up with the typed
    // characters.
    document.documentElement.style.setProperty('--cw', `${this.charWidth()}px`);
    textarea.addEventListener('input', () => this.onInput());
    // Keep the gutter and ruler aligned with the textarea's scroll.
    textarea.addEventListener('scroll', () => {
      this.gutter.style.transform = `translateY(${-textarea.scrollTop}px)`;
      this.ruler.style.transform = `translateX(${-textarea.scrollLeft}px)`;
    });
  }

  get text(): string {
    return this.textarea.value;
  }

  // Replace the text (a load, an undo, a tool edit). Setting the value does
  // not fire `input`, so this never re-enters the owner.
  set text(value: string) {
    this.textarea.value = value;
  }

  // Refresh the gutter and ruler for `text`.
  showLines(text: string): void {
    const lines = text.split('\n');
    this.gutter.textContent = SourceEditor.gutterText(lines.length);
    this.ruler.textContent = SourceEditor.rulerText(
      Math.max(SourceEditor.MIN_RULER_COLS, ...lines.map((l) => l.length + 1)),
    );
  }

  // "1\n2\n…" — one number per line.
  static gutterText(lineCount: number): string {
    let s = '';
    for (let i = 1; i <= lineCount; i++) s += `${i}\n`;
    return s;
  }

  // A column scale: '|' every 10 columns, '+' every 5, '·' between.
  static rulerText(cols: number): string {
    let s = '';
    for (let i = 0; i < cols; i++) s += i % 10 === 0 ? '|' : i % 5 === 0 ? '+' : '·';
    return s;
  }

  private onInput(): void {
    this.events.onInput();
    clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => this.events.onSettle(), SourceEditor.DEBOUNCE_MS);
  }

  // Width of one character in the textarea's monospace font.
  private charWidth(): number {
    const style = getComputedStyle(this.textarea);
    const ctx = document.createElement('canvas').getContext('2d')!;
    ctx.font = `${style.fontSize} ${style.fontFamily}`;
    return ctx.measureText('0').width;
  }
}

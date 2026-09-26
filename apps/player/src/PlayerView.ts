import { LevelPicker } from './LevelPicker.ts';
import { MessagePanel } from './MessagePanel.ts';
import type { PageState } from './PageState.ts';

// The player page's elements (index.html), wrapped in small view objects.
// PlayerApp talks to this instead of querying the DOM itself.
export class PlayerView {
  constructor(
    private readonly document: Document,
    readonly picker: LevelPicker,
    readonly message: MessagePanel,
    readonly canvas: HTMLCanvasElement,
  ) {}

  // Find the elements in index.html. They are part of the page, so a
  // missing one is a bug and fails loudly.
  static fromDocument(doc: Document): PlayerView {
    return new PlayerView(
      doc,
      new LevelPicker(PlayerView.find<HTMLSelectElement>(doc, '#level')),
      new MessagePanel(PlayerView.find<HTMLElement>(doc, '#message')),
      PlayerView.find<HTMLCanvasElement>(doc, '#game'),
    );
  }

  // Mirror the page state on <body data-state> for the CSS and e2e specs.
  showState(state: PageState): void {
    this.document.body.dataset.state = state;
  }

  // Move focus off the <select> so the arrow keys steer the player
  // instead of changing level.
  focusGame(): void {
    this.canvas.focus({ preventScroll: true });
  }

  // Listen for keys in the capture phase, so the page sees Esc / Enter /
  // Space before the focused <select> acts on them.
  onKeyDown(handler: (event: KeyboardEvent) => void): void {
    this.document.addEventListener('keydown', handler, true);
  }

  private static find<T extends Element>(doc: Document, selector: string): T {
    const element = doc.querySelector<T>(selector);
    if (!element) throw new Error(`The player page has no ${selector} element.`);
    return element;
  }
}

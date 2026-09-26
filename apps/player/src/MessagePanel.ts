import type { ValidationIssue } from '@2d-platform/level-format';

// The message panel over the stage (#message): a heading and a few lines
// saying what the page is doing or what went wrong.
export class MessagePanel {
  constructor(private readonly element: HTMLElement) {}

  // A heading with optional paragraphs under it.
  show(title: string, lines: readonly string[] = []): void {
    this.render(title, lines, false);
  }

  // A heading with a bulleted list under it.
  showList(title: string, items: readonly string[]): void {
    this.render(title, items, true);
  }

  // A launch-gate reason as a readable sentence, e.g. "Line 3, column 7:
  // unknown glyph 'Q'". Issues about the level as a whole (no spawn, no
  // exit) are reported at line 1, column 1.
  static describeIssue({ line, col, message }: ValidationIssue): string {
    return `Line ${line}, column ${col}: ${message}`;
  }

  // Replace the panel's contents.
  private render(title: string, lines: readonly string[], asList: boolean): void {
    const doc = this.element.ownerDocument;
    const heading = doc.createElement('h2');
    heading.textContent = title;
    const body = doc.createElement(asList ? 'ul' : 'div');
    for (const line of lines) {
      const item = doc.createElement(asList ? 'li' : 'p');
      item.textContent = line;
      body.append(item);
    }
    this.element.replaceChildren(heading, body);
  }
}

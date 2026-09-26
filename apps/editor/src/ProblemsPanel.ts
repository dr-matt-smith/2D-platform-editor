import { IssueSummary } from './IssueSummary.ts';
import type { IssueLike } from './IssueSummary.ts';

// The message bar under the editor (`#problems`): one line summarising the
// level's issues, tinted by severity through its `data-severity` attribute.
export class ProblemsPanel {
  constructor(private readonly element: HTMLElement) {}

  show(issues: readonly IssueLike[]): void {
    const { text, severity } = IssueSummary.of(issues);
    this.element.textContent = text;
    this.element.dataset.severity = severity;
  }

  // Replay the flash animation, to draw the eye when Play is refused.
  flash(): void {
    this.element.classList.remove('flash');
    void this.element.offsetWidth; // force a reflow so the animation restarts
    this.element.classList.add('flash');
  }
}

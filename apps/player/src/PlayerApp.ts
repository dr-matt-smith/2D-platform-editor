import { MessagePanel } from './MessagePanel.ts';
import { PageState } from './PageState.ts';
import { StartStatus } from './StartStatus.ts';
import type { LevelCatalog } from './LevelCatalog.ts';
import type { LevelEntry } from './LevelEntry.ts';
import type { LevelUrl } from './LevelUrl.ts';
import type { PlaySession } from './PlaySession.ts';
import type { PlayerView } from './PlayerView.ts';
import type { ValidationIssue } from '@2d-platform/level-format';

// The player app: pick a level from the bundled manifest and play it
// full-window.
//
// It owns the page state (see PageState) and moves between states in
// response to the level picker, the keyboard and the play session. It
// never queries the DOM itself; it is handed its collaborators.
export class PlayerApp {
  private state = PageState.Loading;
  private catalog: LevelCatalog | null = null;

  constructor(
    private readonly view: PlayerView,
    private readonly session: PlaySession,
    private readonly url: LevelUrl,
    private readonly loadCatalog: () => Promise<LevelCatalog>,
  ) {}

  // Wire up the page, load the level list and play the requested level
  // (or the first one).
  async start(): Promise<void> {
    this.view.picker.onChange((id) => {
      this.url.remember(id);
      void this.playSelectedLevel();
    });
    this.view.onKeyDown((event) => this.handleKey(event));

    try {
      this.catalog = await this.loadCatalog();
    } catch (err) {
      this.showError('Could not load the levels', err);
      return;
    }

    this.view.picker.fill(this.catalog.groups());
    const id = this.catalog.pick(this.url.requested());
    if (id === null) {
      this.setState(PageState.Error);
      this.view.message.show('No levels found', ['The level manifest is empty.']);
      return;
    }
    this.view.picker.value = id;
    await this.playSelectedLevel();
  }

  private setState(next: PageState): void {
    this.state = next;
    this.view.showState(next);
  }

  // Esc stops a game (or a load); Enter or Space starts the selected level
  // once stopped.
  private handleKey(event: KeyboardEvent): void {
    if (event.key === 'Escape' && (this.state === PageState.Playing || this.state === PageState.Loading)) {
      event.preventDefault();
      this.stopPlaying();
    } else if ((event.key === 'Enter' || event.key === ' ') && this.state === PageState.Stopped) {
      event.preventDefault();
      void this.playSelectedLevel();
    }
  }

  private async playSelectedLevel(): Promise<void> {
    const catalog = this.catalog;
    const level = catalog?.find(this.view.picker.value);
    if (!catalog || !level) return;

    this.setState(PageState.Loading);
    this.view.message.show(`Loading ${level.name}…`);
    try {
      const result = await this.session.start(() => catalog.loadText(level));
      if (result.status === StartStatus.Playing) {
        this.setState(PageState.Playing);
        this.view.focusGame();
      } else if (result.status === StartStatus.Invalid) {
        this.showInvalid(level, result.reasons);
      }
      // Cancelled: a newer start() or an Esc has taken over; nothing to do.
    } catch (err) {
      this.showError('Something went wrong', err);
    }
  }

  private showInvalid(level: LevelEntry, reasons: ValidationIssue[]): void {
    this.setState(PageState.Invalid);
    this.view.message.showList(`“${level.name}” can't be played yet`, reasons.map(MessagePanel.describeIssue));
  }

  private showError(title: string, err: unknown): void {
    this.setState(PageState.Error);
    this.view.message.show(title, [err instanceof Error ? err.message : String(err)]);
  }

  private stopPlaying(): void {
    this.session.stop();
    this.setState(PageState.Stopped);
    this.view.message.show('Paused', ['Choose a level, then press Enter or Space to play.']);
    this.view.picker.focus();
  }
}

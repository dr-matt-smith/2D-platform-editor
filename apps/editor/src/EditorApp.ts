import { Level, LevelText, Role } from '@2d-platform/level-format';
import type { ValidationIssue } from '@2d-platform/level-format';
import { ActiveTileset } from './ActiveTileset.ts';
import { AgentController } from './AgentController.ts';
import { BrowserStorage } from './BrowserStorage.ts';
import { ConfirmDialog } from './ConfirmDialog.ts';
import { DragFillTool } from './DragFillTool.ts';
import { EditorMode } from './EditorMode.ts';
import { EditorView } from './EditorView.ts';
import { KeyboardShortcuts } from './KeyboardShortcuts.ts';
import { LegendPanel } from './LegendPanel.ts';
import { LevelDialog } from './LevelDialog.ts';
import type { NewLevelSpec } from './LevelDialog.ts';
import { LevelFile } from './LevelFile.ts';
import { LevelLibrary } from './LevelLibrary.ts';
import { LevelMenu } from './LevelMenu.ts';
import { PaneSplitter } from './PaneSplitter.ts';
import { PasteLoadDialog } from './PasteLoadDialog.ts';
import { PlayModeController } from './PlayModeController.ts';
import { PlaySettingsDialog } from './PlaySettingsDialog.ts';
import { Preferences } from './Preferences.ts';
import { PreviewPane } from './PreviewPane.ts';
import { ProblemsPanel } from './ProblemsPanel.ts';
import { ProblemsSplitter } from './ProblemsSplitter.ts';
import { Shortcut } from './Shortcut.ts';
import { SourceEditor } from './SourceEditor.ts';
import { ThemeController } from './ThemeController.ts';
import { TilesetMenu } from './TilesetMenu.ts';
import { Toolbar } from './Toolbar.ts';
import { UndoHistory } from './UndoHistory.ts';

// The three answers to "this level has unsaved changes".
type UnsavedChoice = 'save' | 'discard' | 'cancel';

// The level editor. This is the composition root: the constructor builds
// every component, hands each the collaborators it needs, and connects
// their events to the methods below. The components never reach for one
// another; anything that crosses between them goes through here.
//
// It also owns the one piece of state they all share — which level is
// open — and the editing flow around it: load, edit, undo, save a draft
// or discard it.
export class EditorApp {
  // Shown when the level library cannot be reached (offline, bad deploy).
  static readonly SAMPLE = `# name: tutorial-01
# size: 24x10
########################
#......................#
#...P.............E....#
#.................######
#.......oooo...........#
#......######..........#
#......................#
#..........^^^.........#
#......................#
########################`;

  private readonly prefs: Preferences;
  private readonly theme: ThemeController;
  private readonly tilesets = new ActiveTileset();
  private readonly history = new UndoHistory();
  private readonly library: LevelLibrary;
  private readonly source: SourceEditor;
  private readonly preview: PreviewPane;
  private readonly legend: LegendPanel;
  private readonly problems: ProblemsPanel;
  private readonly toolbar: Toolbar;
  private readonly tilesetMenu: TilesetMenu;
  private readonly levelMenu: LevelMenu;
  private readonly playMode: PlayModeController;
  private readonly agent: AgentController;
  // The open level's id; null for an unsaved new level or the sample.
  private currentId: string | null = null;

  constructor(root: HTMLElement) {
    const view = EditorView.mount(root);
    // Splitters first, so saved pane sizes apply on the very first paint.
    const storage = BrowserStorage.withFallback();
    PaneSplitter.attach({ storage });
    ProblemsSplitter.attach({ storage });

    this.prefs = new Preferences(new BrowserStorage());
    this.theme = new ThemeController(this.prefs);
    this.theme.apply();

    this.source = new SourceEditor(view.source, view.gutter, view.ruler, {
      onInput: () => this.refreshDirty(),
      onSettle: () => {
        void this.refresh(); // the `# tileset:` line may have changed
        this.history.push(this.source.text); // one undo step per pause in typing
      },
    });
    this.preview = new PreviewPane(view.preview, view.overlay, view.canvasWrap, this.prefs);
    this.legend = new LegendPanel(view.legend, view.rightPane, this.tilesets, this.prefs, {
      backgroundImage: () => Level.parse(this.source.text).meta.backgroundImage ?? '',
      onBackgroundImage: (id) => this.editDirective((t) => t.setBackgroundImage(id)),
      onLayoutChange: () => this.preview.applyFit(),
    });
    this.legend.applyLayout();
    this.legend.render();
    this.preview.applyFit();

    this.library = new LevelLibrary({ fetch: (url) => fetch(url), storage });
    this.problems = new ProblemsPanel(view.problems);
    this.toolbar = new Toolbar(view.toolbar, view.dirty, view.fitButton, view.themeButton, {
      download: () => void this.downloadLevel(this.currentId),
      play: () => this.playMode.start(),
      playSettings: () => this.openPlaySettings(),
      test: () => this.agent.open(),
      toggleFit: () => this.toggleFit(),
      toggleTheme: () => {
        this.theme.toggle();
        this.toolbar.showTheme(this.theme.theme);
      },
      newLevel: () => this.openLevelDialog(),
      load: () => this.openPasteLoad(),
      restart: () => this.playMode.restart(),
      exit: () => this.playMode.exit(),
    });
    this.toolbar.showFit(this.preview.fitToScreen);
    this.toolbar.showTheme(this.theme.theme);
    this.tilesetMenu = new TilesetMenu(view.tilesetSelect, this.library, (id) => {
      this.editDirective((t) => t.setTileset(id));
    });
    this.levelMenu = new LevelMenu(view.levelSelect, this.library, (id) => this.chooseLevel(id));

    this.playMode = new PlayModeController(this.preview, this.tilesets, this.toolbar, this.problems, {
      text: () => this.source.text,
      issues: (level) => this.issuesOf(level),
      repaint: () => this.repaint(),
    });
    this.agent = new AgentController(
      () => this.source.text,
      this.tilesets,
      this.preview,
      this.toolbar,
      this.playMode,
      this.prefs,
    );
    new DragFillTool(this.preview, {
      glyph: () => this.legend.glyph,
      text: () => this.source.text,
      commit: (text) => this.commitEdit(text),
    });
    KeyboardShortcuts.attach(document, (command) => this.runShortcut(command));

    // Warn before leaving the page with unsaved changes.
    window.addEventListener('beforeunload', (e) => {
      if (this.currentId && this.library.isDirty(this.source.text)) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  // Load the level library and open the last-used level (or the first
  // one, or — offline — the built-in sample).
  async start(): Promise<void> {
    try {
      await this.library.init();
      await this.tilesetMenu.populate(); // before openBuffer, so the menu can select
      this.levelMenu.populate();
      const list = this.library.list();
      const last = this.library.lastOpen();
      const startId = (last && list.some((l) => l.id === last) ? last : null) || list[0]?.id;
      if (startId) {
        this.openBuffer(await this.library.load(startId), startId);
        return;
      }
    } catch { /* fall through to the sample */ }
    this.openBuffer(EditorApp.SAMPLE, null);
  }

  // --- the edit cycle ----------------------------------------------------

  // Validate and draw the buffer. Skipped during Play, when the engine
  // owns the canvas.
  private repaint(): void {
    if (this.playMode.mode === EditorMode.Play) return;
    const text = this.source.text;
    const level = Level.parse(text);
    this.problems.show(this.issuesOf(level));
    this.preview.draw(level, this.tilesets.tileset);
    this.source.showLines(text);
  }

  // Switch to the tileset the buffer names (loading it if need be), then
  // repaint. Used wherever the `# tileset:` line may have changed.
  private async refresh(): Promise<void> {
    const changed = await this.tilesets.sync(Level.parse(this.source.text).meta.tileset);
    if (changed) this.legend.render();
    this.tilesetMenu.sync(Level.parse(this.source.text).meta.tileset);
    this.repaint();
  }

  // The level's validation issues, plus any tileset warning.
  private issuesOf(level: Level): ValidationIssue[] {
    const issues = level.validate(this.tilesets.legend);
    if (this.tilesets.warning) issues.push(this.tilesets.warning);
    return issues;
  }

  // Show `text` as a freshly opened level `id`, with a new undo timeline.
  private openBuffer(text: string, id: string | null): void {
    this.source.text = text;
    this.currentId = id;
    if (id) this.library.setLastOpen(id);
    this.history.reset(text);
    this.repaint(); // at once, with the current tileset…
    void this.refresh(); // …then again with this level's, once loaded
    this.refreshDirty();
    this.levelMenu.sync(id);
  }

  // Replace the buffer with an edit, as one undoable step.
  private commitEdit(text: string): void {
    this.source.text = text;
    this.history.push(text);
    this.repaint();
    this.refreshDirty();
  }

  // Show a state from the undo history (without pushing it again).
  private restore(text: string | null): void {
    if (text == null) return;
    this.source.text = text;
    void this.refresh(); // an undone state may name another tileset
    this.refreshDirty();
  }

  // Rewrite one header directive (tileset, background image) through
  // LevelText, which leaves the rest of the text untouched.
  private editDirective(edit: (text: LevelText) => LevelText): void {
    const updated = edit(new LevelText(this.source.text)).toString();
    if (updated !== this.source.text) this.commitEdit(updated);
    void this.refresh();
  }

  // Update the "unsaved" marker; returns whether there are unsaved changes.
  private refreshDirty(): boolean {
    const dirty = this.library.isDirty(this.source.text);
    this.toolbar.showDirty(dirty);
    return dirty;
  }

  private runShortcut(command: Shortcut): void {
    switch (command) {
      case Shortcut.OpenLevels:
        return this.openLevelDialog();
      case Shortcut.Play:
        return this.playMode.start();
      case Shortcut.Undo:
        return this.restore(this.history.undo(this.source.text));
      case Shortcut.Redo:
        return this.restore(this.history.redo());
    }
  }

  private toggleFit(): void {
    this.preview.fitToScreen = !this.preview.fitToScreen;
    this.toolbar.showFit(this.preview.fitToScreen);
    this.preview.refit();
  }

  // --- switching levels --------------------------------------------------

  // Run `proceed` once the open level's unsaved changes are dealt with:
  // saved as a draft, discarded, or — on Cancel — kept (then `onCancel`
  // runs, by default reopening the Levels dialog). An unsaved new level
  // has no draft to keep, so it proceeds at once.
  private guardUnsaved(proceed: () => void, onCancel?: () => void): void {
    if (!(this.currentId && this.refreshDirty())) {
      proceed();
      return;
    }
    new ConfirmDialog<UnsavedChoice>({
      message: `“${this.currentId}” has unsaved changes.`,
      actions: [
        { label: 'Save draft & continue', value: 'save', primary: true },
        { label: 'Discard & continue', value: 'discard' },
        { label: 'Cancel', value: 'cancel' },
      ],
      onChoice: (choice) => {
        if (choice === 'cancel') return onCancel ? onCancel() : this.openLevelDialog();
        if (choice === 'save') this.library.save(this.currentId!, this.source.text);
        proceed();
      },
    }).open();
  }

  private async loadInto(id: string): Promise<void> {
    try {
      this.openBuffer(await this.library.load(id), id);
    } catch { /* keep the current buffer if the level fails to load */ }
  }

  private switchTo(id: string): void {
    if (id === this.currentId) return;
    this.guardUnsaved(() => void this.loadInto(id));
  }

  // The Level menu. On Cancel, put the menu back on the open level.
  private chooseLevel(id: string): void {
    if (id === '' || id === this.currentId) return; // "(untitled)", or no change
    this.guardUnsaved(
      () => void this.loadInto(id),
      () => this.levelMenu.sync(this.currentId),
    );
  }

  // A blank level of the chosen tileset and size, opened unsaved (no id),
  // so it cannot overwrite any draft.
  private newLevel({ id, w, h }: NewLevelSpec): void {
    this.guardUnsaved(() => {
      const head = ['# name: untitled', `# size: ${w}x${h}`];
      if (id && id !== Level.DEFAULT_TILESET) head.push(`# tileset: ${id}`);
      const row = Level.BACKGROUND_GLYPH.repeat(w);
      this.openBuffer([...head, ...Array.from({ length: h }, () => row)].join('\n'), null);
    });
  }

  // Download level `id`: the live buffer if it is the open one (unsaved
  // edits included), else its stored text.
  private async downloadLevel(id: string | null): Promise<void> {
    const text = id && id !== this.currentId ? await this.library.peek(id) : this.source.text;
    LevelFile.from(id || this.currentId, text).download();
  }

  // --- dialogs -------------------------------------------------------------

  private openLevelDialog(): void {
    new LevelDialog({
      library: this.library,
      currentId: this.currentId,
      onSelect: (id) => this.switchTo(id),
      onDownload: (id) => void this.downloadLevel(id),
      onNew: (spec) => this.newLevel(spec),
    }).open();
  }

  // Load pasted text as a new local level.
  private openPasteLoad(): void {
    this.guardUnsaved(() => {
      new PasteLoadDialog({
        onLoad: ({ text, name }) => {
          const problem = PasteLoadDialog.problemWith(text);
          if (problem) return problem;
          void this.loadInto(this.library.addLocal(text, name));
          return null;
        },
        onCancel: () => {},
      }).open();
    });
  }

  // Edit `# pickup-required:` and `# viewport:`, saved as one undo step.
  private openPlaySettings(): void {
    const level = Level.parse(this.source.text);
    new PlaySettingsDialog({
      pickupRequired: level.meta.pickupRequired ?? 'all',
      viewport: level.meta.viewport,
      total: level.findCells(Role.Pickup, this.tilesets.legend).length,
      onSave: ({ pickupRequired, viewport }) => {
        const updated = new LevelText(this.source.text)
          .setPickupRequired(pickupRequired)
          .setViewport(viewport)
          .toString();
        if (updated !== this.source.text) this.commitEdit(updated);
      },
    }).open();
  }
}

// The editor page's markup, and typed references to the elements the
// components drive. `mount` writes the page once; everything after that
// updates these elements in place. The ids and classes here are what the
// stylesheet and the end-to-end specs rely on.
export class EditorView {
  private static readonly HTML = `
  <div class="editor">
    <div class="pane left">
      <div class="ruler-col" id="rulerCol"><span></span></div>
      <div class="edit-area">
        <div class="gutter" id="gutter"><span></span></div>
        <textarea id="src" spellcheck="false" autocomplete="off"></textarea>
      </div>
    </div>
    <div class="splitter" id="splitter" title="Drag to resize panes · double-click to reset"></div>
    <div class="pane right">
      <div class="status">
        <button id="dlBtn" class="edit-only" title="Download current level as .txt">Download</button>
        <button id="playBtn" class="edit-only" title="Playtest current level (Ctrl/Cmd+Enter)">Play</button>
        <button id="playSettingsBtn" class="edit-only" title="Play settings (pickup requirement, etc.)">Play Settings</button>
        <button id="testBtn" class="edit-only" title="AI agent: does the level have a solution?">Test</button>
        <button id="fitBtn" class="edit-only" title="Fit canvas to available space (toggle)">⛶ Fit</button>
        <button id="themeBtn" class="edit-only" title="Toggle light/dark mode">🌗</button>
        <button id="newBtn" class="edit-only" title="New level (opens the levels dialog)">New</button>
        <button id="loadBtn" class="edit-only" title="Load — paste level text">Load</button>
        <label class="level-pick edit-only" title="Switch level (unsaved drafts are guarded)">
          <span>Level:</span>
          <select id="levelSel"></select>
        </label>
        <label class="tileset-pick edit-only" title="Tileset (sets the # tileset: directive)">
          <span>Tileset:</span>
          <select id="tilesetSel"></select>
        </label>
        <button id="restartBtn" class="play-only" title="Restart (R)">Restart</button>
        <button id="exitBtn" class="play-only" title="Exit (Esc)">Exit</button>
        <span id="dirty"></span>
      </div>
      <div class="canvas-wrap">
        <div class="stage">
          <canvas id="preview"></canvas>
          <canvas id="overlay"></canvas>
        </div>
      </div>
      <div class="legend" id="legend" title="Click a glyph to draw with it · drag on the preview to fill · hold Shift to draw an outline"></div>
    </div>
  </div>
  <div class="splitter-h" id="splitterH" title="Drag to resize · double-click to reset"></div>
  <div class="problems" id="problems"></div>
`;

  readonly source: HTMLTextAreaElement;
  readonly gutter: HTMLElement;
  readonly ruler: HTMLElement;
  readonly rightPane: HTMLElement;
  readonly toolbar: HTMLElement;
  readonly dirty: HTMLElement;
  readonly fitButton: HTMLButtonElement;
  readonly themeButton: HTMLButtonElement;
  readonly levelSelect: HTMLSelectElement;
  readonly tilesetSelect: HTMLSelectElement;
  readonly canvasWrap: HTMLElement;
  readonly preview: HTMLCanvasElement;
  readonly overlay: HTMLCanvasElement;
  readonly legend: HTMLElement;
  readonly problems: HTMLElement;

  private constructor(private readonly root: HTMLElement) {
    this.source = this.get<HTMLTextAreaElement>('#src');
    this.gutter = this.get('#gutter span');
    this.ruler = this.get('#rulerCol span');
    this.rightPane = this.get('.pane.right');
    this.toolbar = this.get('.pane.right > .status');
    this.dirty = this.get('#dirty');
    this.fitButton = this.get<HTMLButtonElement>('#fitBtn');
    this.themeButton = this.get<HTMLButtonElement>('#themeBtn');
    this.levelSelect = this.get<HTMLSelectElement>('#levelSel');
    this.tilesetSelect = this.get<HTMLSelectElement>('#tilesetSel');
    this.canvasWrap = this.get('.canvas-wrap');
    this.preview = this.get<HTMLCanvasElement>('#preview');
    this.overlay = this.get<HTMLCanvasElement>('#overlay');
    this.legend = this.get('#legend');
    this.problems = this.get('#problems');
  }

  // Write the page into `root` and return its elements.
  static mount(root: HTMLElement): EditorView {
    root.innerHTML = EditorView.HTML;
    return new EditorView(root);
  }

  private get<T extends HTMLElement = HTMLElement>(selector: string): T {
    return this.root.querySelector<T>(selector)!;
  }
}

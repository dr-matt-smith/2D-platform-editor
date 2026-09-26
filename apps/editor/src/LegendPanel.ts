import { Role } from '@2d-platform/level-format';
import type { LegendEntry } from '@2d-platform/level-format';
import { ImageRole } from '@2d-platform/render';
import type { ActiveTileset } from './ActiveTileset.ts';
import { escapeHtml } from './escapeHtml.ts';
import { LegendLayout } from './LegendLayout.ts';
import type { Preferences } from './Preferences.ts';

// What the legend panel reports to the editor.
export interface LegendPanelEvents {
  // The level's current `# background-image:` id ('' for none).
  backgroundImage(): string;
  // The user picked a background image (null for none).
  onBackgroundImage(id: string | null): void;
  // The panel moved or changed size, so the preview should re-fit.
  onLayoutChange(): void;
}

// The legend (`#legend`): the active tileset's glyphs grouped by role,
// each a button that makes it the glyph the fill tool paints with. A small
// toolbar minimises the panel or moves it between the right of the preview
// and below it; both choices are saved. When the tileset has background
// images, a menu sets the level's `# background-image:`.
export class LegendPanel {
  // Group headings, in order. Decoration and foreground glyphs share a
  // final "Decorations" group with the tileset's decoration images.
  private static readonly ROLE_GROUPS: ReadonlyArray<[Role, string]> = [
    [Role.Background, 'Empty'],
    [Role.Terrain, 'Terrain'],
    [Role.Player, 'Player'],
    [Role.Exit, 'Exit'],
    [Role.Hazard, 'Hazard'],
    [Role.Pickup, 'Pickup'],
  ];

  private activeGlyph = '#';
  private layout: LegendLayout;
  private collapsed: boolean;

  constructor(
    private readonly element: HTMLElement,
    private readonly pane: HTMLElement,
    private readonly tilesets: ActiveTileset,
    private readonly prefs: Preferences,
    private readonly events: LegendPanelEvents,
  ) {
    this.layout = prefs.legendLayout;
    this.collapsed = prefs.legendCollapsed;
    element.addEventListener('click', (e) => this.onClick(e));
    element.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      if (target.matches('#bgImgSel')) this.events.onBackgroundImage(target.value || null);
    });
  }

  // The glyph the fill tool paints with.
  get glyph(): string {
    return this.activeGlyph;
  }

  // Set the pane's layout classes (legend right or bottom, minimised).
  applyLayout(): void {
    this.pane.classList.remove('layout-right', 'layout-bottom');
    this.pane.classList.add(this.layout === LegendLayout.Right ? 'layout-right' : 'layout-bottom');
    this.pane.classList.toggle('legend-collapsed', this.collapsed);
  }

  render(): void {
    const parts: string[] = [this.toolbarHtml(), '<div class="legend-body">'];
    parts.push(this.backgroundMenuHtml());

    const byRole = new Map<Role, [string, LegendEntry][]>();
    for (const [glyph, entry] of this.tilesets.legend) {
      const role = entry.role || Role.Unknown;
      byRole.set(role, [...(byRole.get(role) ?? []), [glyph, entry]]);
    }
    for (const [role, label] of LegendPanel.ROLE_GROUPS) {
      const entries = byRole.get(role);
      if (!entries?.length) continue;
      parts.push(`<div class="legend-group">${escapeHtml(label)}</div>`);
      for (const [glyph, entry] of entries) parts.push(this.glyphButtonHtml(glyph, entry));
    }
    parts.push(this.decorationsHtml(byRole));

    parts.push('</div>'); // .legend-body
    this.element.innerHTML = parts.join('');
  }

  private onClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    const act = target.closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'legend-min') {
      this.collapsed = !this.collapsed;
      this.prefs.legendCollapsed = this.collapsed;
      this.relayout();
      return;
    }
    if (act === 'legend-swap') {
      this.layout = this.layout === LegendLayout.Right ? LegendLayout.Bottom : LegendLayout.Right;
      this.prefs.legendLayout = this.layout;
      this.relayout();
      return;
    }
    const glyph = target.closest<HTMLElement>('[data-glyph]')?.dataset.glyph;
    if (glyph == null) return;
    this.activeGlyph = glyph;
    this.render();
  }

  private relayout(): void {
    this.applyLayout();
    this.render();
    this.events.onLayoutChange();
  }

  // Minimise and swap buttons; first, so they stay visible when minimised.
  private toolbarHtml(): string {
    const other = this.layout === LegendLayout.Right ? LegendLayout.Bottom : LegendLayout.Right;
    return (
      `<div class="legend-toolbar">` +
      `<button class="legend-toggle" data-act="legend-min" ` +
      `title="${this.collapsed ? 'Expand legend' : 'Minimise legend'}">` +
      `${this.collapsed ? '▶' : '—'}</button>` +
      `<button class="legend-toggle" data-act="legend-swap" ` +
      `title="Swap legend to ${other}">↕</button>` +
      `</div>`
    );
  }

  // The Background menu, only when the tileset declares background images.
  private backgroundMenuHtml(): string {
    const images = this.imagesWithRole(ImageRole.Background);
    if (!images.length) return '';
    const current = this.events.backgroundImage();
    const options = [
      `<option value=""${current === '' ? ' selected' : ''}>(none)</option>`,
      ...images.map(
        ([id, name]) =>
          `<option value="${escapeHtml(id)}"${id === current ? ' selected' : ''}>` +
          `${escapeHtml(name)}</option>`,
      ),
    ].join('');
    return (
      `<div class="legend-group">Background:</div>` +
      `<label class="bg-pick"><select id="bgImgSel">${options}</select></label>`
    );
  }

  // Decoration and foreground glyphs, then the tileset's decoration images
  // (shown for reference; they cannot be placed yet).
  private decorationsHtml(byRole: Map<Role, [string, LegendEntry][]>): string {
    const glyphs = [...(byRole.get(Role.Decoration) ?? []), ...(byRole.get(Role.Foreground) ?? [])];
    const images = this.imagesWithRole(ImageRole.Decoration);
    if (!glyphs.length && !images.length) return '';
    const base = this.tilesets.thumbnailBase;
    return [
      `<div class="legend-group">Decorations</div>`,
      ...glyphs.map(([glyph, entry]) => this.glyphButtonHtml(glyph, entry)),
      ...images.map(([id, name, image]) => {
        const thumb = image
          ? `<img class="thumb" src="${base}${image}" alt="">`
          : `<span class="thumb" style="background:#888"></span>`;
        return (
          `<span class="glyph inert" data-image-id="${escapeHtml(id)}" ` +
          `title="Decoration image — placement coming in v19+">` +
          `${thumb}${escapeHtml(name)}</span>`
        );
      }),
    ].join('');
  }

  // The tileset's `images` entries with `role`, as [id, display name, image].
  private imagesWithRole(role: ImageRole): Array<[string, string, string | null]> {
    const images = this.tilesets.lookup?.images;
    if (!images) return [];
    return Object.entries(images)
      .filter(([, def]) => def?.role === role)
      .map(([id, def]) => [id, def!.name || id, def!.image ?? null]);
  }

  // A glyph button: its thumbnail (the tileset image, or a colour swatch
  // if it has none or the image fails) and its name.
  private glyphButtonHtml(glyph: string, entry: LegendEntry): string {
    const thumb = entry.image
      ? `<img class="thumb" src="${this.tilesets.thumbnailBase}${entry.image}" alt="" ` +
        `onerror="this.replaceWith(Object.assign(document.createElement('span'),` +
        `{className:'thumb'}))">`
      : `<span class="thumb" style="background:${entry.color || 'transparent'}"></span>`;
    const active = glyph === this.activeGlyph ? ' active' : '';
    return (
      `<button class="glyph${active}" data-glyph="${escapeHtml(glyph)}" title="${escapeHtml(glyph)}">` +
      `${thumb}${escapeHtml(entry.name || glyph)}</button>`
    );
  }
}

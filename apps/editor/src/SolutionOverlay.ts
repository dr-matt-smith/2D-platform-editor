import type { LevelLayout, TraceEntry } from '@2d-platform/agent';

// The part of an agent `Solution` the overlay paints.
export interface OverlaySolution {
  plan?: {
    trace: TraceEntry[];
    graph: LevelLayout | null;
    goals?: string[];
  } | null;
}

// How to paint one path: its colour (path and pickup markers) and opacity.
export interface OverlayStyle {
  colour?: string;
  alpha?: number;
}

// Paints the agent's solution paths onto a canvas: a line from the start
// through each planned step (jumps drawn as arcs), with markers — S at the
// start, 1, 2, 3… at each pickup in visit order, E at the exit.
//
// An overlay is bound to one canvas context and grid: `tile` pixels per
// cell, the level starting `yOffset` pixels down (below the HUD band).
// The caller sizes and clears the canvas.
export class SolutionOverlay {
  // One hue per solution, readable on the light and dark themes. The first
  // is the colour a single solution is drawn in.
  static readonly HUE_PALETTE: readonly string[] = [
    '#ffcc00', // warm yellow (Solution 1)
    '#66d9e8', // cyan        (Solution 2)
    '#f06292', // magenta     (Solution 3)
    '#aed581', // lime        (Solution 4)
    '#ffb84d', // orange      (Solution 5)
  ];
  // Opacity of the paths that are not focused.
  static readonly DIMMED_ALPHA = 0.35;

  private static readonly PATH_COLOUR = '#ffcc00';
  private static readonly START_COLOUR = '#3498db'; // the Dirt player's blue
  private static readonly EXIT_COLOUR = '#2ecc71'; // the exit's green
  private static readonly INK = '#0a0b0e';
  // Points sampled along each jump arc.
  private static readonly ARC_SAMPLES = 6;

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly tile: number,
    private readonly yOffset = 0,
  ) {}

  // Paint one solution's path and markers.
  paint(solution: OverlaySolution | null | undefined, style: OverlayStyle = {}): void {
    if (!solution || !solution.plan) return;
    const { trace, graph, goals } = solution.plan;
    if (!trace.length || !graph?.start) return;

    const { ctx } = this;
    const pathColour = style.colour ?? SolutionOverlay.PATH_COLOUR;
    ctx.save();
    ctx.globalAlpha = style.alpha ?? 1;
    if (this.yOffset) ctx.translate(0, this.yOffset);

    ctx.lineWidth = 3;
    ctx.strokeStyle = pathColour;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    let { x: sx, y: sy } = this.centre(graph.start.c, graph.start.r);
    ctx.moveTo(sx, sy);
    for (const entry of trace) {
      const { x: tx, y: ty } = this.centre(entry.target.c, entry.target.r);
      if (entry.kind === 'jump') {
        for (const p of SolutionOverlay.arc(sx, sy, tx, ty, this.tile)) ctx.lineTo(p.x, p.y);
      } else {
        ctx.lineTo(tx, ty);
      }
      sx = tx;
      sy = ty;
    }
    ctx.stroke();

    // goals are in visit order; the last is always the exit.
    this.marker(graph.start.c, graph.start.r, 'S', SolutionOverlay.START_COLOUR);
    if (goals) {
      goals.forEach((goal, i) => {
        const [r, c] = goal.split(',').map(Number);
        const isExit = i === goals.length - 1;
        this.marker(c, r, isExit ? 'E' : String(i + 1), isExit ? SolutionOverlay.EXIT_COLOUR : pathColour);
      });
    }
    ctx.restore();
  }

  // Paint every solution at once, each in its own hue: the others dimmed
  // first, then the focused one solid on top.
  paintAll(solutions: OverlaySolution[], focusedIdx: number): void {
    if (!Array.isArray(solutions) || solutions.length === 0) return;
    const focused = Math.max(0, Math.min(focusedIdx, solutions.length - 1));
    const hue = (i: number) => SolutionOverlay.HUE_PALETTE[i % SolutionOverlay.HUE_PALETTE.length];
    solutions.forEach((solution, i) => {
      if (i !== focused) this.paint(solution, { colour: hue(i), alpha: SolutionOverlay.DIMMED_ALPHA });
    });
    this.paint(solutions[focused], { colour: hue(focused), alpha: 1.0 });
  }

  // Points along a jump from (x0, y0) to (x1, y1): a quadratic Bézier
  // peaking about one tile above the higher end. The start point is not
  // included (the path is already there).
  static arc(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    tile: number,
    samples = SolutionOverlay.ARC_SAMPLES,
  ): Array<{ x: number; y: number }> {
    const peakY = Math.min(y0, y1) - tile;
    const midX = (x0 + x1) / 2;
    const out: Array<{ x: number; y: number }> = [];
    for (let i = 1; i <= samples; i++) {
      const t = i / samples;
      const u = 1 - t;
      out.push({
        x: u * u * x0 + 2 * u * t * midX + t * t * x1,
        y: u * u * y0 + 2 * u * t * peakY + t * t * y1,
      });
    }
    return out;
  }

  private centre(c: number, r: number): { x: number; y: number } {
    return { x: c * this.tile + this.tile / 2, y: r * this.tile + this.tile / 2 };
  }

  // A labelled disc on cell (c, r).
  private marker(c: number, r: number, label: string, colour: string): void {
    const { ctx, tile } = this;
    const { x, y } = this.centre(c, r);
    ctx.beginPath();
    ctx.arc(x, y, tile * 0.32, 0, Math.PI * 2);
    ctx.fillStyle = colour;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = SolutionOverlay.INK;
    ctx.stroke();
    ctx.fillStyle = SolutionOverlay.INK;
    ctx.font = `bold ${Math.round(tile * 0.55)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y);
  }
}

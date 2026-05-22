// v20 path overlay: draws the agent's planned trajectory + numbered
// goal markers onto a 2D canvas context. Pure — takes a ctx + a
// solution + the level dims, draws, returns nothing.
//
// Designed for the editor's existing #overlay canvas (sibling to
// #preview, position: absolute, inset: 0). The caller is responsible
// for sizing the canvas, clearing it before re-paint, and gating
// painting on dialog open/close.

const POLY_COLOUR = '#ffcc00';        // warm yellow path
const START_COLOUR = '#3498db';        // blue (matches Dirt player disc)
const PICKUP_COLOUR = '#ffcc00';
const EXIT_COLOUR = '#2ecc71';        // green (matches exit)

/**
 * @param ctx       CanvasRenderingContext2D for the overlay
 * @param solution  testLevel() result's `.solution` (from runner.js)
 * @param tile      pixel size per cell (editor TILE = 24)
 */
export function renderSolutionOverlay(ctx, solution, tile) {
  if (!solution || !solution.plan) return;
  const { trace, graph, goals } = solution.plan;
  if (!trace.length || !graph?.start) return;

  ctx.save();

  // Polyline: start point → each trace target's cell center.
  // v21: jump entries render as parabolic arcs (6 intermediate
  // sample points via a quadratic Bezier with a peak above the
  // higher endpoint), so the visual path curves naturally. Walk
  // and drop entries stay as straight segments.
  ctx.lineWidth = 3;
  ctx.strokeStyle = POLY_COLOUR;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  let sx = graph.start.c * tile + tile / 2;
  let sy = graph.start.r * tile + tile / 2;
  ctx.moveTo(sx, sy);
  for (const entry of trace) {
    const tx = entry.target.c * tile + tile / 2;
    const ty = entry.target.r * tile + tile / 2;
    if (entry.kind === 'jump') {
      for (const p of jumpArcSamples(sx, sy, tx, ty, tile, 6)) {
        ctx.lineTo(p.x, p.y);
      }
    } else {
      ctx.lineTo(tx, ty);
    }
    sx = tx;
    sy = ty;
  }
  ctx.stroke();

  // Markers — S at start, 1/2/3 at each pickup in visit order, E at exit.
  // goals[] is in visit order, last entry is always an exit cell.
  drawMarker(ctx, graph.start.c, graph.start.r, tile, 'S', START_COLOUR);
  if (goals) {
    for (let i = 0; i < goals.length; i++) {
      const [r, c] = goals[i].split(',').map(Number);
      const isExit = i === goals.length - 1;
      const label = isExit ? 'E' : String(i + 1);
      const colour = isExit ? EXIT_COLOUR : PICKUP_COLOUR;
      drawMarker(ctx, c, r, tile, label, colour);
    }
  }

  ctx.restore();
}

/**
 * Quadratic-Bezier samples approximating a parabolic jump arc from
 * (x0, y0) to (x1, y1). Peak height ≈ 1 tile above the higher of the
 * two endpoints. Returns N points (not including the start; the start
 * is implicit via the caller's moveTo or previous lineTo).
 */
function jumpArcSamples(x0, y0, x1, y1, tile, samples = 6) {
  const peakY = Math.min(y0, y1) - tile;
  const midX = (x0 + x1) / 2;
  const out = [];
  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const u = 1 - t;
    const x = u * u * x0 + 2 * u * t * midX + t * t * x1;
    const y = u * u * y0 + 2 * u * t * peakY + t * t * y1;
    out.push({ x, y });
  }
  return out;
}

function drawMarker(ctx, c, r, tile, label, colour) {
  const cx = c * tile + tile / 2;
  const cy = r * tile + tile / 2;
  // Circle.
  ctx.beginPath();
  ctx.arc(cx, cy, tile * 0.32, 0, Math.PI * 2);
  ctx.fillStyle = colour;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#0a0b0e';
  ctx.stroke();
  // Label.
  ctx.fillStyle = '#0a0b0e';
  ctx.font = `bold ${Math.round(tile * 0.55)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, cy);
}

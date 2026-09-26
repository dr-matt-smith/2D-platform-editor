/** Any axis-aligned box: position of the top-left corner plus size, in px. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Axis = "x" | "y";

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

// Resolve overlap on one axis after moving on that axis. Returns the
// corrected coordinate on `axis` (caller assigns it back), or null when
// the rects don't overlap.
export function resolveAxis(player: Rect, solid: Rect, axis: Axis): number | null {
  if (!rectsOverlap(player, solid)) return null;
  if (axis === "x") {
    return player.x + player.w / 2 < solid.x + solid.w / 2
      ? solid.x - player.w
      : solid.x + solid.w;
  }
  return player.y + player.h / 2 < solid.y + solid.h / 2
    ? solid.y - player.h
    : solid.y + solid.h;
}

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

// Resolve overlap on one axis after moving on that axis. Returns the
// corrected coordinate on `axis` (caller assigns it back), or null when
// the rects don't overlap.
export function resolveAxis(player, solid, axis) {
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

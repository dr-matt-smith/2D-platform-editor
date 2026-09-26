import { Axis } from './Axis.ts';
import type { Box } from './Box.ts';

// Axis-aligned bounding-box (AABB) collision tests. Stateless, so the
// helpers are static methods on the concept rather than free functions.
//
// Adapted from simple-platformer-1 (CC BY 4.0) — see ../LICENSE. The
// arithmetic is unchanged: the Python port's golden vectors depend on it.
export class Aabb {
  private constructor() {}

  // True when the two boxes overlap. Touching edges do not count.
  static overlaps(a: Box, b: Box): boolean {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
      a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // Resolve an overlap on one axis after `mover` has moved along it.
  // Returns the corrected coordinate on `axis` (the caller assigns it
  // back), or null when the boxes don't overlap. The mover is pushed out
  // on whichever side of `solid` its centre is nearer.
  static resolveAxis(mover: Box, solid: Box, axis: Axis): number | null {
    if (!Aabb.overlaps(mover, solid)) return null;
    if (axis === Axis.X) {
      return mover.x + mover.w / 2 < solid.x + solid.w / 2
        ? solid.x - mover.w
        : solid.x + solid.w;
    }
    return mover.y + mover.h / 2 < solid.y + solid.h / 2
      ? solid.y - mover.h
      : solid.y + solid.h;
  }
}

// Any axis-aligned box: the position of its top-left corner plus its size,
// in world pixels. Every `Entity` is a `Box`, and so is any plain
// `{ x, y, w, h }` object, so collision helpers accept either.
//
// Adapted from simple-platformer-1's `Rect` (CC BY 4.0) — see ../LICENSE.
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

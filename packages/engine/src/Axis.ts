// One of the two directions a box can move along. The player moves and
// resolves collisions one axis at a time (see `Aabb.resolveAxis`).
//
// Adapted from simple-platformer-1 (CC BY 4.0) — see ../LICENSE.
export enum Axis {
  X = 'x',
  Y = 'y',
}

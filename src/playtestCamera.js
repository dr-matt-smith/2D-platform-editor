// Pure camera math for v19's scrolling playtest. PlaytestScene owns the
// state (`camX`, `camY`); this module owns the *math* — split out so
// `node --test` can cover it without a DOM, and so the dead-zone tuning
// lives in one place.
//
// World coordinates throughout. `playerCenter`, `viewport`, `world`, and
// the returned `{camX, camY}` are all in world pixels (i.e. cells * TILE).
//
// Dead-zone (centred in viewport) defaults from design §4.2 — 40% wide
// by 33% tall. Author-configurable dead-zone is a v20+ candidate.

const DEFAULT_DEAD_ZONE_W_FRACTION = 0.4;
const DEFAULT_DEAD_ZONE_H_FRACTION = 0.33;

/**
 * Clamp a camera origin to the world bounds.
 *
 *   - If `world` is wider than `viewport` on an axis, camera is clamped
 *     to `[0, world - viewport]` on that axis.
 *   - If `world` is smaller-or-equal on an axis, camera is pinned to 0
 *     (the world sits at the top-left of an oversized viewport; the
 *     renderer paints SKY in the remainder).
 */
function clampCamera(camX, camY, viewport, world) {
  const maxX = Math.max(0, world.w - viewport.w);
  const maxY = Math.max(0, world.h - viewport.h);
  return {
    camX: Math.max(0, Math.min(camX, maxX)),
    camY: Math.max(0, Math.min(camY, maxY)),
  };
}

/**
 * Initialise the camera so the player center sits at the centre of the
 * viewport, world-edge-clamped. Used by `PlaytestScene.restart()` so
 * there's no one-frame visual jump from (0,0) to the spawn-centred
 * position.
 *
 * @param playerCenter { x, y } in world pixels
 * @param viewport     { w, h } in world pixels
 * @param world        { w, h } in world pixels
 * @returns            { camX, camY }
 */
export function centerCamera(playerCenter, viewport, world) {
  return clampCamera(
    playerCenter.x - viewport.w / 2,
    playerCenter.y - viewport.h / 2,
    viewport,
    world,
  );
}

/**
 * Dead-zone camera follow. Returns the camera origin for the next frame
 * given the player's centre, the previous camera origin, the viewport,
 * and the world. The dead-zone is a rectangle centred in the viewport
 * (fractions per design §4.2). If the player stays inside the dead-zone
 * (in viewport coords), the camera doesn't move; if the player crosses
 * a dead-zone edge, the camera shifts by *exactly* the overshoot so the
 * player ends up back on that edge.
 *
 * Result is always world-edge-clamped. Pure: never mutates its inputs.
 *
 * @param playerCenter   { x, y } in world pixels
 * @param prev           { camX, camY } previous camera origin
 * @param viewport       { w, h } in world pixels
 * @param world          { w, h } in world pixels
 * @param opts.deadZone  optional { w, h } as fractions [0..1] of viewport
 * @returns              { camX, camY }
 */
export function computeCamera(playerCenter, prev, viewport, world, opts = {}) {
  const dzWFrac = opts.deadZone?.w ?? DEFAULT_DEAD_ZONE_W_FRACTION;
  const dzHFrac = opts.deadZone?.h ?? DEFAULT_DEAD_ZONE_H_FRACTION;
  const dzW = viewport.w * dzWFrac;
  const dzH = viewport.h * dzHFrac;
  // Dead-zone half-margin: distance from viewport edge to dead-zone edge.
  // For a centred 40%-wide dead-zone the margin is 30% of viewport.w
  // on each side.
  const halfMarginW = (viewport.w - dzW) / 2;
  const halfMarginH = (viewport.h - dzH) / 2;

  // Player position expressed in viewport coords (where the dead-zone is
  // stationary). If the player is past either edge of the dead-zone,
  // shift the camera so the player ends up exactly on that edge.
  const pvX = playerCenter.x - prev.camX;
  const pvY = playerCenter.y - prev.camY;
  let camX = prev.camX;
  let camY = prev.camY;
  if (pvX < halfMarginW) camX = playerCenter.x - halfMarginW;
  else if (pvX > viewport.w - halfMarginW) camX = playerCenter.x - (viewport.w - halfMarginW);
  if (pvY < halfMarginH) camY = playerCenter.y - halfMarginH;
  else if (pvY > viewport.h - halfMarginH) camY = playerCenter.y - (viewport.h - halfMarginH);

  return clampCamera(camX, camY, viewport, world);
}

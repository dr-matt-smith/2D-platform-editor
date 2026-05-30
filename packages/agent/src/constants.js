// v29 M4: the agent's local engine-physics constants.
//
// Through v28 the agent imported these straight from
// src/play/constants.js — an implicit, direct dependency on the
// vendored engine (v9 §7). v29 carves the agent into its own package
// (packages/agent/ in M5); a package can't reach back into the
// editor's src/play/* without re-coupling them. So the agent owns a
// copy of the physics constants it discretises levels against.
//
// These MUST match the engine the adapter wraps. The adapter's TILE
// is verified against this TILE at plan()/testLevel() entry
// (assertAdapter in planner.js) — a Python (or other) adapter that
// ships a different TILE throws loudly at the boundary rather than
// silently emitting edges the live engine never reproduces. SPEED /
// JUMP_FORCE / GRAVITY feed the agent's jump-reach prefilter +
// action enumeration; they share the same engine-physics contract.
export const TILE       = 20;
export const SPEED      = 240;
export const JUMP_FORCE = 560;
export const GRAVITY    = 1600;

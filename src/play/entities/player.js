import { SPEED, JUMP_FORCE, GRAVITY, TILE } from "../constants.js";
import { resolveAxis } from "../core/aabb.js";
import { logEvent } from "../logger.js";

/**
 * The controllable player. An AABB with velocity, gravity, and a single
 * jump. Movement is resolved one axis at a time per frame:
 *
 *   1. apply gravity to vy
 *   2. move on x, resolve any horizontal overlaps with platforms
 *   3. move on y with a *swept* test: detect whether the player's feet
 *      crossed a platform's top surface between the old and new y this
 *      frame (landing), or the head crossed a ceiling (head bump)
 *
 * The y axis is swept rather than "teleport then test overlap" because
 * a fast fall covers far more than a thin (14 px) platform's height in
 * one frame (gravity 1600, dt capped at 1/30 → up to ~38 px/frame), so
 * endpoint-only overlap tests tunnel straight through. Sweeping tests
 * the crossing, which is speed-independent.
 *
 * Resolving each axis separately is what lets the player slide along a
 * floor without snagging on tile seams, and lets a wall stop horizontal
 * motion without affecting falling.
 *
 * The player consults `scene.game.input` for keys and iterates over
 * `scene.platforms` for collisions, so it must be `update()`-ed with
 * the owning scene as the second arg.
 */
export class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.w = TILE; this.h = TILE;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
  }

  update(dt, scene) {
    const input = scene.game.input;

    this.vx = 0;
    if (input.isDown("left"))  this.vx = -SPEED;
    if (input.isDown("right")) this.vx =  SPEED;

    if (input.wasPressed("left"))  logEvent("input:left");
    if (input.wasPressed("right")) logEvent("input:right");

    const wantsJump = input.wasPressed("space") || input.wasPressed("up");
    if (wantsJump && this.onGround) {
      this.vy = -JUMP_FORCE;
      this.onGround = false;
      logEvent("input:jump", { pos: this.snap() });
    } else if (wantsJump) {
      logEvent("input:jump:ignored", { pos: this.snap() });
    }

    this.vy += GRAVITY * dt;

    this.x += this.vx * dt;
    for (const p of scene.platforms) {
      const corrected = resolveAxis(this, p, "x");
      if (corrected !== null) this.x = corrected;
    }

    // Swept y resolution. Test the crossing between prevY and movedY
    // rather than overlap at movedY, so fast falls can't tunnel through
    // thin platforms. movedY is the intended position; per-platform
    // corrections must not feed back into other platforms' sweep maths.
    const prevY  = this.y;
    const movedY = prevY + this.vy * dt;

    let resolvedY  = movedY;
    let landed     = false;
    let bumped     = false;
    this.onGround  = false;

    for (const p of scene.platforms) {
      // Only collide vertically when horizontally over/under the tile.
      if (this.x >= p.x + p.w || this.x + this.w <= p.x) continue;

      if (this.vy >= 0) {
        // Falling: did the feet cross the platform's top this frame?
        const prevBottom  = prevY  + this.h;
        const movedBottom = movedY + this.h;
        if (prevBottom <= p.y && movedBottom >= p.y) {
          const top = p.y - this.h;
          // Keep the highest surface reached (first one the feet hit).
          if (!landed || top < resolvedY) resolvedY = top;
          landed = true;
        }
      } else {
        // Rising: did the head cross the platform's underside?
        const ceiling = p.y + p.h;
        if (prevY >= ceiling && movedY <= ceiling) {
          // Keep the lowest ceiling (first one the head hits).
          if (!bumped || ceiling > resolvedY) resolvedY = ceiling;
          bumped = true;
        }
      }
    }

    this.y = resolvedY;
    if (landed) { this.vy = 0; this.onGround = true; }
    else if (bumped) { this.vy = 0; }
  }

  draw(ctx, assets) {
    ctx.drawImage(assets.sprite("player"), this.x, this.y, this.w, this.h);
  }

  snap() {
    return { x: Math.round(this.x), y: Math.round(this.y) };
  }
}

import { GRAVITY, JUMP_FORCE, SPEED, TILE, COLOURS } from './constants.ts';
import { Aabb } from './Aabb.ts';
import { Axis } from './Axis.ts';
import { Entity } from './Entity.ts';
import { Key } from './Key.ts';
import type { Box } from './Box.ts';
import type { InputSource } from './InputSource.ts';
import type { UpdateContext } from './UpdateContext.ts';

// A pose to force the player into (see `Player.setState`). Velocity and
// the ground flag default to a standing start.
export interface PlayerStateOverride {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  onGround?: boolean;
}

// The player: a box with velocity, gravity and a single jump.
//
// Each frame, in this order:
//   1. read the keys: set the run speed, start a jump if on the ground;
//   2. apply gravity to the vertical speed;
//   3. move along x, then push out of any platform it now overlaps;
//   4. move along y with a *swept* test (see `moveY`).
// Resolving each axis on its own lets the player slide along a floor
// without catching on tile seams, and lets a wall stop running without
// affecting falling.
//
// The position, velocity and `onGround` are public because the agent's
// physics contract reads them every frame and sets them to start a
// simulation from a chosen state.
//
// Adapted from simple-platformer-1 (CC BY 4.0) — see ../LICENSE. The
// arithmetic and its order are unchanged: the Python port's golden
// vectors check this class frame for frame.
export class Player extends Entity {
  vx = 0;
  vy = 0;
  onGround = false;

  constructor(x: number, y: number) {
    super(x, y, TILE, TILE);
  }

  override update(dt: number, { input, solids }: UpdateContext): void {
    this.steer(input);
    this.vy += GRAVITY * dt;
    this.moveX(dt, solids);
    this.moveY(dt, solids);
  }

  // Force a pose and velocity (the agent starts each simulated action
  // from an exact state).
  setState({ x, y, vx = 0, vy = 0, onGround = false }: PlayerStateOverride): void {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.onGround = onGround;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = COLOURS.text;
    ctx.fillRect(this.x, this.y, this.w, this.h);
  }

  // Run left/right while a direction is held; jump only from the ground.
  private steer(input: InputSource): void {
    this.vx = 0;
    if (input.isDown(Key.Left)) this.vx = -SPEED;
    if (input.isDown(Key.Right)) this.vx = SPEED;

    const wantsJump = input.wasPressed(Key.Space) || input.wasPressed(Key.Up);
    if (wantsJump && this.onGround) {
      this.vy = -JUMP_FORCE;
      this.onGround = false;
    }
  }

  // Move along x, then push back out of any solid now overlapped.
  private moveX(dt: number, solids: readonly Box[]): void {
    this.x += this.vx * dt;
    for (const p of solids) {
      const corrected = Aabb.resolveAxis(this, p, Axis.X);
      if (corrected !== null) this.x = corrected;
    }
  }

  // Move along y with a swept test: did the feet cross a platform's top
  // (landing) or the head cross its underside (bump) between the old and
  // new y? Testing only the end position would let a fast fall (up to
  // ~38 px a frame) tunnel straight through a thin platform; testing the
  // crossing works at any speed. `movedY` is the intended position, and
  // one platform's correction never feeds into another's test.
  private moveY(dt: number, solids: readonly Box[]): void {
    const prevY = this.y;
    const movedY = prevY + this.vy * dt;

    let resolvedY = movedY;
    let landed = false;
    let bumped = false;
    this.onGround = false;

    for (const p of solids) {
      // Only collide vertically when horizontally over/under the tile.
      if (this.x >= p.x + p.w || this.x + this.w <= p.x) continue;

      if (this.vy >= 0) {
        // Falling: did the feet cross the platform's top this frame?
        const prevBottom = prevY + this.h;
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
    if (landed) {
      this.vy = 0;
      this.onGround = true;
    } else if (bumped) {
      this.vy = 0;
    }
  }
}

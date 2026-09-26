import { COLOURS } from './constants.ts';
import { Entity } from './Entity.ts';
import { PlatformKind } from './PlatformKind.ts';

// A solid rectangle the player collides with. Terrain cells become
// ground platforms; the two kinds differ only in how they are drawn.
//
// Adapted from simple-platformer-1 (CC BY 4.0) — see ../LICENSE.
export class Platform extends Entity {
  readonly kind: PlatformKind;

  constructor(x: number, y: number, w: number, h: number, kind: PlatformKind = PlatformKind.Platform) {
    super(x, y, w, h);
    this.kind = kind;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = this.kind === PlatformKind.Ground ? COLOURS.ground : COLOURS.platform;
    ctx.fillRect(this.x, this.y, this.w, this.h);
    if (this.kind === PlatformKind.Platform) {
      ctx.strokeStyle = COLOURS.platformLine;
      ctx.lineWidth = 2;
      ctx.strokeRect(this.x + 1, this.y + 1, this.w - 2, this.h - 2);
    }
  }
}

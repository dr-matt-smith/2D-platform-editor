import type { CameraWindow } from '@2d-platform/render';
import type { Point } from './Point.ts';
import type { Size } from './Size.ts';

// A camera position: the top-left corner of the view, in world pixels.
export interface CameraOrigin {
  camX: number;
  camY: number;
}

// The dead zone's size as fractions (0..1) of the viewport.
export interface DeadZone {
  w: number;
  h: number;
}

// The scrolling camera of a playtest whose level sets `# viewport:`. It
// shows a viewport-sized window of the world and follows the player with a
// *dead zone*: a box centred in the view inside which the player moves
// freely. When the player crosses a dead-zone edge the camera moves by
// exactly the overshoot, so the player sits back on that edge. The camera
// never shows anything outside the world; on an axis where the world is
// smaller than the viewport it stays at 0.
//
// All positions and sizes are world pixels.
export class PlaytestCamera {
  // Default dead zone: 40% of the viewport wide, 33% tall.
  static readonly DEFAULT_DEAD_ZONE: Readonly<DeadZone> = { w: 0.4, h: 0.33 };

  readonly viewport: Size;
  readonly world: Size;
  private readonly deadZone: DeadZone;
  private camX = 0;
  private camY = 0;

  constructor(viewport: Size, world: Size, deadZone: Partial<DeadZone> = {}) {
    this.viewport = viewport;
    this.world = world;
    this.deadZone = {
      w: deadZone.w ?? PlaytestCamera.DEFAULT_DEAD_ZONE.w,
      h: deadZone.h ?? PlaytestCamera.DEFAULT_DEAD_ZONE.h,
    };
  }

  get x(): number {
    return this.camX;
  }

  get y(): number {
    return this.camY;
  }

  get origin(): CameraOrigin {
    return { camX: this.camX, camY: this.camY };
  }

  // What the renderer needs to draw this camera's view.
  get view(): CameraWindow {
    return { camX: this.camX, camY: this.camY, viewW: this.viewport.w, viewH: this.viewport.h };
  }

  // Jump to `origin` (clamped to the world).
  moveTo(origin: CameraOrigin): void {
    this.clampTo(origin.camX, origin.camY);
  }

  // Centre the view on `target` (clamped to the world). Used when a
  // playtest (re)starts, so the first frame is already on the player.
  centreOn(target: Point): void {
    this.clampTo(
      target.x - this.viewport.w / 2,
      target.y - this.viewport.h / 2,
    );
  }

  // Follow `target` for one frame with the dead-zone rule.
  follow(target: Point): void {
    const viewport = this.viewport;
    const dzW = viewport.w * this.deadZone.w;
    const dzH = viewport.h * this.deadZone.h;
    // Distance from a viewport edge to the dead-zone edge on that side.
    const halfMarginW = (viewport.w - dzW) / 2;
    const halfMarginH = (viewport.h - dzH) / 2;

    // The target in view coordinates, where the dead zone stands still.
    const pvX = target.x - this.camX;
    const pvY = target.y - this.camY;
    let camX = this.camX;
    let camY = this.camY;
    if (pvX < halfMarginW) camX = target.x - halfMarginW;
    else if (pvX > viewport.w - halfMarginW) camX = target.x - (viewport.w - halfMarginW);
    if (pvY < halfMarginH) camY = target.y - halfMarginH;
    else if (pvY > viewport.h - halfMarginH) camY = target.y - (viewport.h - halfMarginH);

    this.clampTo(camX, camY);
  }

  // Set the position, keeping it within [0, world - viewport] per axis.
  private clampTo(camX: number, camY: number): void {
    const maxX = Math.max(0, this.world.w - this.viewport.w);
    const maxY = Math.max(0, this.world.h - this.viewport.h);
    this.camX = Math.max(0, Math.min(camX, maxX));
    this.camY = Math.max(0, Math.min(camY, maxY));
  }
}

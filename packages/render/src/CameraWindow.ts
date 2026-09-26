// The part of the world a scrolling camera shows, in world pixels: the
// top-left corner (camX, camY) and the size of the view.
export interface CameraWindow {
  camX: number;
  camY: number;
  viewW: number;
  viewH: number;
}

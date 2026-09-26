// What the editor is doing right now. Only one mode is active at a time;
// `PlayModeController` owns the value and every other part asks it.
export enum EditorMode {
  // Editing the level text; the preview repaints on every change.
  Edit = 'edit',
  // Playtesting with the keyboard; the engine owns the canvas.
  Play = 'play',
  // Replaying an agent solution; like Play, but scripted and auto-exiting.
  Demo = 'demo',
}

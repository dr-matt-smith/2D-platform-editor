// Game state that can change which sprite a glyph shows. The playtest
// passes it while playing; the editor preview never does, so authors
// always see the normal sprites.
export interface EntityState {
  // True while the exit is locked (the pickup rule is not yet met): the
  // exit then shows its `imageLocked` sprite, if the tileset has one.
  exitLocked?: boolean;
}

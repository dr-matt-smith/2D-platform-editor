// A level's text plus where it came from.
export interface LevelFile {
  // The manifest id, or null for a level given as a file path.
  id: string | null;
  path: string;
  text: string;
}

// One level from content/data/levels/manifest.json.
export interface LevelEntry {
  id: string;
  // Shown in the picker; defaults to the id.
  name: string;
  // The file under data/levels/.
  file: string;
  // Heading to list the level under in the picker, if any.
  group?: string;
}

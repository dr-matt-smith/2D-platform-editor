// Options shared by every command that runs the agent.
export interface RunOptions {
  // Search time budget per level, in milliseconds.
  budgetMs: number;
  // Print JSON instead of text.
  json: boolean;
  // The folder holding levels/ and tilesets/.
  contentDir: string;
}

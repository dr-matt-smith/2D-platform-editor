/** Any input source a scene reads (keyboard or scripted). */
export interface InputSource {
  isDown(key: string): boolean;
  wasPressed(key: string): boolean;
  endFrame(): void;
  /** Present on scripted sources; applies events up to `frame`. */
  advance?(frame: number): void;
}

/** A scripted input source over a recording (what the adapter makes). */
export interface ScriptedInputHandle extends InputSource {
  advance(frame: number): void;
}

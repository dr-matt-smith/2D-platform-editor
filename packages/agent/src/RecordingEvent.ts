/** One scripted key event: `key` goes down (or up) at `frame`. */
export interface RecordingEvent {
  frame: number;
  key: string;
  down: boolean;
}

/** Frame-indexed key events — what the planner emits and the engine replays. */
export type Recording = RecordingEvent[];

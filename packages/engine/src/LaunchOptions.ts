import type { RecordingEvent } from './RecordingEvent.ts';

// Optional settings for `Playtest.launch`.
export interface LaunchOptions {
  // Demo mode: replay this recording instead of reading the keyboard.
  recording?: readonly RecordingEvent[];
}

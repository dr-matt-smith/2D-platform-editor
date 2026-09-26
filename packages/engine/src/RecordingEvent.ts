import type { KeyName } from './Key.ts';

// One event of an input recording: at `frame`, `key` goes down (true) or
// up (false). A recording is an array of these, e.g.
//   [{ frame: 0,  key: 'right', down: true  },
//    { frame: 30, key: 'space', down: true  },
//    { frame: 31, key: 'space', down: false },
//    { frame: 60, key: 'right', down: false }]
// This is the shape the agent's planner produces and `ScriptedInput` plays.
export interface RecordingEvent {
  frame: number;
  key: KeyName;
  down: boolean;
}

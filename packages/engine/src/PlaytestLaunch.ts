import type { GateResult } from './GateResult.ts';
import type { Playtest } from './Playtest.ts';

// What `Playtest.launch` returns. Three outcomes:
//   - launched:        ok, no reasons, `playtest` is the running playtest;
//   - refused:         not ok, `reasons` says why, `playtest` is null;
//   - already running: ok, no reasons, `playtest` is null (only one
//                      playtest runs at a time; the call did nothing).
export interface PlaytestLaunch extends GateResult {
  playtest: Playtest | null;
}

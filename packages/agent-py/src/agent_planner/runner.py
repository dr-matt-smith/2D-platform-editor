"""Runner — the Python port of packages/agent/src/LevelTester.ts.

Orchestrates the agent: plan -> simulate -> replan, under a wall-clock time
budget, then searches for different routes: each solution queues one
variation per step (its blocks plus that step, longest step first), tried
breadth first. Returns up to K (=5) solutions that differ in both route and
keys, fewest frames first.

The JS runner is async (it yields to the event loop and honours an
AbortSignal between attempts). The Python port is synchronous with a
monotonic-clock deadline; pass `should_abort` (a 0-arg callable returning
True to stop) if you need cooperative cancellation.
"""

import time

from .planner import assert_adapter, plan, replan
from .sim import simulate

# v26 M4: 2400 frames == 40s sim time. The sub-pixel state-space graph has
# more nodes; chained plans can exceed 20s sim time.
SIM_MAX_FRAMES = 2400
MAX_SOLUTIONS = 5


def test_level(parsed, legend, tileset=None, adapter=None, max_runtime_ms=5000,
               on_progress=None, should_abort=None, replan_budget=20,
               planner="perframe", tol=None, node_cap=None):
    """Test a level: plan + headless-validate + replan under a time budget.

    Returns a dict: on success {"ok": True, "solutions": [...],
    "solution": solutions[0]}; on failure {"ok": False, "last_plan",
    "last_sim", "attempts", "reason"?}.
    """
    assert_adapter(adapter, "test_level()")
    on_progress = on_progress or (lambda elapsed, total: None)
    start_time = time.monotonic()

    def yield_tick():
        elapsed = (time.monotonic() - start_time) * 1000
        on_progress(elapsed, max_runtime_ms)
        if should_abort and should_abort():
            return False
        if elapsed >= max_runtime_ms:
            return False
        return True

    plan_opts = {"adapter": adapter, "tileset": tileset, "planner": planner, "tol": tol, "node_cap": node_cap}

    current_plan = plan(parsed, legend, **plan_opts)
    if not yield_tick():
        return {"ok": False, "last_plan": current_plan, "last_sim": None,
                "attempts": 0, "reason": "timeout-during-plan"}

    if len(current_plan["trace"]) == 0:
        return {"ok": False, "last_plan": current_plan, "last_sim": None, "attempts": 0}

    solutions = []
    # A solution counts as new only if both its route and its keys are.
    seen_routes = set()
    seen_recordings = set()

    def is_new(pln):
        return route_key(pln) not in seen_routes and _recording_hash(pln["recording"]) not in seen_recordings

    alternatives = _AlternativeQueue()
    blocked = set()  # the steps the current plan was made to avoid
    last_sim = None
    attempt = 0

    while attempt < replan_budget and len(solutions) < MAX_SOLUTIONS:
        attempt += 1
        sim = simulate(adapter, parsed, legend, recording=current_plan["recording"],
                       tileset=tileset, max_frames=SIM_MAX_FRAMES)
        last_sim = sim
        if not yield_tick():
            break

        nxt = None
        if sim["outcome"] == "won":
            if is_new(current_plan):
                seen_routes.add(route_key(current_plan))
                seen_recordings.add(_recording_hash(current_plan["recording"]))
                solutions.append({
                    "plan": current_plan,
                    "recording": current_plan["recording"],
                    "stats": {
                        "steps": current_plan["stats"]["steps"],
                        "walks": current_plan["stats"]["walks"],
                        "jumps": current_plan["stats"]["jumps"],
                        "drops": current_plan["stats"]["drops"],
                        "attempts": attempt,
                        "frame": sim["frame"],
                        "score": sim["score"],
                    },
                    "unreachable": current_plan["unreachable"],
                })
                alternatives.add_variations_of(current_plan, blocked)
        else:
            # Replan around the step that was running when the replay failed.
            repaired = replan(current_plan, sim, parsed, legend, adapter=adapter, tileset=tileset,
                              planner=planner, tol=tol, node_cap=node_cap, blocked=blocked)
            if repaired and len(repaired["trace"]) > 0 and not _same_recording(current_plan, repaired):
                nxt = repaired
                blocked = blocked | {_step_at_frame(current_plan, sim["frame"])["edge_id"]}
        if len(solutions) >= MAX_SOLUTIONS:
            break

        # Otherwise try queued variations until one plans a route not yet seen.
        while nxt is None:
            candidate = alternatives.next()
            if candidate is None:
                break
            pln = plan(parsed, legend, blocked=set(candidate), **plan_opts)
            if not yield_tick():
                break
            if len(pln["trace"]) > 0 and is_new(pln):
                nxt = pln
                blocked = set(candidate)
        if nxt is None:
            break
        current_plan = nxt

    if len(solutions) > 0:
        solutions.sort(key=lambda s: s["stats"]["frame"])
        return {"ok": True, "solutions": solutions, "solution": solutions[0]}

    return {"ok": False, "last_plan": current_plan, "last_sim": last_sim, "attempts": attempt}


def route_key(pln):
    """The route as one string: the step ids in order (mirrors Plan.routeKey)."""
    return "|".join(e["edge_id"] for e in pln["trace"])


def steps_to_block(pln, blocked):
    """Step ids not already in `blocked`, longest step first (the earliest on
    a tie), without repeats (mirrors Plan.stepsToBlock)."""
    seen = set()
    steps = []
    for order, entry in enumerate(pln["trace"]):
        eid = entry["edge_id"]
        if eid in blocked or eid in seen:
            continue
        seen.add(eid)
        steps.append((-(entry["frame_range"][1] - entry["frame_range"][0]), order, eid))
    steps.sort()
    return [eid for _, _, eid in steps]


class _AlternativeQueue:
    """Block sets still to try, first in first out; each set is queued once."""

    def __init__(self):
        self._pending = []
        self._queued = set()

    def add_variations_of(self, pln, blocked):
        for step in steps_to_block(pln, blocked):
            candidate = frozenset(blocked | {step})
            key = "|".join(sorted(candidate))
            if key in self._queued:
                continue
            self._queued.add(key)
            self._pending.append(candidate)

    def next(self):
        return self._pending.pop(0) if self._pending else None


def _step_at_frame(pln, frame):
    """The trace entry running at `frame`, or the last one after the end."""
    return next(
        (e for e in pln["trace"] if e["frame_range"][0] <= frame < e["frame_range"][1]),
        pln["trace"][-1],
    )


def _same_recording(a, b):
    if not a or not b:
        return False
    if len(a["recording"]) != len(b["recording"]):
        return False
    for ea, eb in zip(a["recording"], b["recording"]):
        if ea["frame"] != eb["frame"] or ea["key"] != eb["key"] or ea["down"] != eb["down"]:
            return False
    return True


def _recording_hash(events):
    return ",".join(f"{e['frame']}|{e['key']}|{1 if e['down'] else 0}" for e in events)

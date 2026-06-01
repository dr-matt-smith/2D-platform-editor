"""Runner — the Python port of packages/agent/src/runner.js.

Orchestrates the agent: plan -> simulate -> replan, under a wall-clock time
budget. Returns up to K (=5) distinct solutions, shortest first.

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
               on_progress=None, should_abort=None, replan_budget=10,
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
    seen_recordings = set()
    last_sim = None
    attempt = 0
    blocked_across_solutions = set()

    while attempt < replan_budget and len(solutions) < MAX_SOLUTIONS:
        attempt += 1
        sim = simulate(adapter, parsed, legend, recording=current_plan["recording"],
                       tileset=tileset, max_frames=SIM_MAX_FRAMES)
        last_sim = sim
        if sim["outcome"] == "won":
            h = _recording_hash(current_plan["recording"])
            if h not in seen_recordings:
                seen_recordings.add(h)
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
            if len(solutions) >= MAX_SOLUTIONS:
                break
            if not yield_tick():
                break

            block_edge = _pick_edge_to_block(current_plan, blocked_across_solutions)
            if not block_edge:
                break
            blocked_across_solutions.add(block_edge)
            alt = plan(parsed, legend, blocked=blocked_across_solutions, **plan_opts)
            if not alt or len(alt["trace"]) == 0:
                break
            if _same_recording(current_plan, alt):
                break
            current_plan = alt
            continue
        if not yield_tick():
            break

        nxt = replan(current_plan, sim, parsed, legend, adapter=adapter, tileset=tileset,
                     planner=planner, tol=tol, node_cap=node_cap)
        if not nxt or len(nxt["trace"]) == 0 or _same_recording(current_plan, nxt):
            break
        current_plan = nxt
        if not yield_tick():
            break

    if len(solutions) > 0:
        solutions.sort(key=lambda s: s["stats"]["frame"])
        return {"ok": True, "solutions": solutions, "solution": solutions[0]}

    return {"ok": False, "last_plan": current_plan, "last_sim": last_sim, "attempts": attempt}


def _pick_edge_to_block(pln, already_blocked):
    """Return the edge_id of the longest-cost trace edge not already
    blocked — typically the most distinctive."""
    best = None
    best_cost = -1
    for entry in pln["trace"]:
        if entry["edge_id"] in already_blocked:
            continue
        cost = entry["frame_range"][1] - entry["frame_range"][0]
        if cost > best_cost:
            best_cost = cost
            best = entry["edge_id"]
    return best


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

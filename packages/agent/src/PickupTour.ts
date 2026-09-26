import { CellKey } from './CellKey.ts';
import { NavGraph } from './NavGraph.ts';
import { StateKey } from './StateKey.ts';
import { XOffsetBucket } from './XOffsetBucket.ts';
import type { PickupRequired } from './ParsedLevel.ts';

/**
 * Chooses which pickups the bucket planner visits, and in what order, to
 * keep the whole route short. Tour costs are real A* path costs over the
 * NavGraph:
 *
 * - all of up to 4 pickups: try every order;
 * - more than 4: nearest-first, then improve by swapping pairs (2-opt);
 * - N of M required: try every combination of N, each ordered as above.
 *
 * Every leg is costed from the still, left-third node of its start cell
 * (where a settled player stands). That is an approximation, but a
 * consistent one; the planner itself tracks the real state.
 */
export class PickupTour {
  private static readonly MAX_TWO_OPT_ITERATIONS = 50;

  private constructor(
    private readonly graph: NavGraph,
    private readonly startKey: string,
    private readonly exitKey: string,
  ) {}

  /**
   * The goal queue as "r,c" cell keys: the chosen pickups in visit order,
   * then the first exit. Empty if the level has no exit. Pickups with no
   * path from the start are left out, so the planner still tries the exit.
   */
  static resolve(graph: NavGraph, requiredPickups: PickupRequired | null | undefined): string[] {
    const exitKey = graph.exitCells[0] ? CellKey.of(graph.exitCells[0].r, graph.exitCells[0].c) : null;
    if (!exitKey) return [];

    const total = graph.pickupCells.length;
    let need: number;
    if (requiredPickups === 'all' || requiredPickups == null) need = total;
    else if (typeof requiredPickups === 'number' && requiredPickups > 0)
      need = Math.min(requiredPickups, total);
    else need = 0;

    if (need === 0) return [exitKey];

    const startCell = graph.start;
    if (!startCell) return [exitKey];
    // A settled spawn is still (speed bucket 0) at the left of its cell.
    const startKey = StateKey.of(startCell.r, startCell.c, 0, XOffsetBucket.Left).toString();
    const allKeys = graph.pickupCells.map((p) => CellKey.of(p.r, p.c));

    const reachable = allKeys.filter((k) => graph.findPath(startKey, k) !== null);
    if (reachable.length === 0) return [exitKey];

    const ordering = new PickupTour(graph, startKey, exitKey).bestOrdering(reachable, need);
    return [...ordering, exitKey];
  }

  // The cheapest `need` pickups from `pickups`, in visit order.
  private bestOrdering(pickups: string[], need: number): string[] {
    const M = pickups.length;
    if (need >= M) {
      return this.bestOrderOfSubset(pickups);
    }
    // C(M, need) combinations: 10 for 3 of 5, 70 for 4 of 8 — small enough.
    let best: string[] | null = null;
    let bestCost = Infinity;
    for (const subset of PickupTour.combinations(pickups, need)) {
      const order = this.bestOrderOfSubset(subset);
      const cost = this.chainCost([...order, this.exitKey]);
      if (cost < bestCost) {
        bestCost = cost;
        best = order;
      }
    }
    return best ?? [];
  }

  // The cheapest order to visit all of `subset` and then the exit.
  private bestOrderOfSubset(subset: string[]): string[] {
    const K = subset.length;
    if (K === 0) return [];
    if (K === 1) return [subset[0]];
    if (K <= 4) {
      // At most 4! = 24 orders: try them all.
      let best: string[] | null = null;
      let bestCost = Infinity;
      for (const perm of PickupTour.permutations(subset)) {
        const cost = this.chainCost([...perm, this.exitKey]);
        if (cost < bestCost) {
          bestCost = cost;
          best = perm;
        }
      }
      return best ?? subset;
    }
    return this.twoOptImprove(this.greedyNearest(subset));
  }

  // Repeatedly go to the pickup with the cheapest path from here.
  private greedyNearest(pickups: string[]): string[] {
    let cur = this.startKey;
    const remaining = [...pickups];
    const order: string[] = [];
    while (remaining.length > 0) {
      let bestKey: string | null = null;
      let bestCost = Infinity;
      for (const c of remaining) {
        const path = this.graph.findPath(cur, c);
        if (!path) continue;
        const cost = NavGraph.pathCost(path);
        if (cost < bestCost) {
          bestCost = cost;
          bestKey = c;
        }
      }
      if (!bestKey) break;
      order.push(bestKey);
      cur = PickupTour.settledKey(bestKey);
      remaining.splice(remaining.indexOf(bestKey), 1);
    }
    return order;
  }

  // Swap pairs of visits while any swap lowers the total cost (capped).
  private twoOptImprove(order: string[]): string[] {
    let best = [...order];
    let bestCost = this.chainCost([...best, this.exitKey]);
    let improved = true;
    let iter = 0;
    while (improved && iter < PickupTour.MAX_TWO_OPT_ITERATIONS) {
      improved = false;
      iter++;
      for (let i = 0; i < best.length - 1; i++) {
        for (let j = i + 1; j < best.length; j++) {
          const candidate = [...best];
          [candidate[i], candidate[j]] = [candidate[j], candidate[i]];
          const cost = this.chainCost([...candidate, this.exitKey]);
          if (cost < bestCost) {
            bestCost = cost;
            best = candidate;
            improved = true;
          }
        }
      }
    }
    return best;
  }

  // Total path cost start → chain[0] → chain[1] → …; Infinity if any leg has no path.
  private chainCost(chain: string[]): number {
    let cur = this.startKey;
    let total = 0;
    for (const g of chain) {
      const path = this.graph.findPath(cur, g);
      if (!path) return Infinity;
      total += NavGraph.pathCost(path);
      cur = PickupTour.settledKey(g);
    }
    return total;
  }

  // A cell key "r,c" as the StateKey of a player settled there ("r,c,0,L").
  private static settledKey(k: string): string {
    return k.split(',').length === 2 ? `${k},0,L` : k;
  }

  // Every size-k combination of `arr`, in lexicographic order.
  private static *combinations<T>(arr: T[], k: number): Generator<T[]> {
    const n = arr.length;
    if (k > n) return;
    const idx = Array.from({ length: k }, (_, i) => i);
    while (true) {
      yield idx.map((i) => arr[i]);
      let i = k - 1;
      while (i >= 0 && idx[i] === n - k + i) i--;
      if (i < 0) return;
      idx[i]++;
      for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
    }
  }

  // Every ordering of `arr`.
  private static *permutations<T>(arr: T[]): Generator<T[]> {
    if (arr.length <= 1) {
      yield [...arr];
      return;
    }
    for (let i = 0; i < arr.length; i++) {
      const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
      for (const p of PickupTour.permutations(rest)) {
        yield [arr[i], ...p];
      }
    }
  }
}

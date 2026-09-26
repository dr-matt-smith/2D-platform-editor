import { BucketPlanner } from './BucketPlanner.ts';
import { PerFramePlanner } from './PerFramePlanner.ts';
import { PlannerKind } from './PlannerKind.ts';
import type { PhysicsAdapter } from './PhysicsAdapter.ts';
import type { Planner } from './Planner.ts';

/**
 * Makes the Planner for a PlannerKind. It lives apart from Planner itself
 * because the subclasses import Planner: if Planner imported them back,
 * the modules would load in a cycle.
 */
export class PlannerFactory {
  /** The strategy used unless another is asked for. */
  static readonly DEFAULT_KIND = PlannerKind.PerFrame;

  private constructor() {}

  /** A planner of `kind` driving `adapter` (checked by AdapterGuard). */
  static create(adapter: PhysicsAdapter, kind: PlannerKind = PlannerFactory.DEFAULT_KIND): Planner {
    switch (kind) {
      case PlannerKind.PerFrame:
        return new PerFramePlanner(adapter);
      case PlannerKind.Bucket:
        return new BucketPlanner(adapter);
    }
  }
}

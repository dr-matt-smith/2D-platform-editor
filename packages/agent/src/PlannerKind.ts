/** Which planning strategy to use (see PlannerFactory). */
export enum PlannerKind {
  /** A* over exact physics states, edges simulated on demand. The default. */
  PerFrame = 'perframe',
  /** A* over a prebuilt graph of bucketed states; kept for diagnostics. */
  Bucket = 'bucket',
}

// How a `Platform` looks. Both kinds collide identically; the difference
// is purely visual so the level layout reads at a glance.
export enum PlatformKind {
  // A full-tile dark block (what terrain cells become).
  Ground = 'ground',
  // A lighter block with an outline, for jumping on.
  Platform = 'platform',
}

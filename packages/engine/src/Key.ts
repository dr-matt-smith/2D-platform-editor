// The keys the game reads, by the normalised name every `InputSource`
// uses. The values are the strings stored in agent recordings
// (`{ frame, key: 'right', down: true }`), so saved recordings still work.
export enum Key {
  Left = 'left',
  Right = 'right',
  Up = 'up',
  Down = 'down',
  Space = 'space',
  // Character keys are their lower-case character; R restarts a playtest.
  R = 'r',
}

// A normalised key name: a `Key`, or any other single printable character
// in lower case (e.g. '1'). Intersecting `string` with an empty record
// keeps editor completion for the `Key` values while still accepting any
// character.
export type KeyName = Key | (string & Record<never, never>);

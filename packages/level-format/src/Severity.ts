// How serious a validation issue is. The values are the strings the apps
// show and style against (e.g. the editor's `data-severity` attribute).
export enum Severity {
  // The level cannot be played until this is fixed.
  Error = 'error',
  // Worth knowing, but the level still loads (e.g. no exit yet).
  Warn = 'warn',
}

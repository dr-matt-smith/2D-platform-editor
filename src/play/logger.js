// v9 vendored SHIM (TDD v9 design §7.1). Upstream simple-platformer-1 logs
// gameplay events to localStorage; the editor must not pollute the author's
// storage, so logEvent/setScene/clearLog are no-ops here. Keeping this module
// (instead of editing the call sites) lets every other vendored file stay
// byte-identical to upstream@4c3b936 for a clean future re-sync.
export const logEvent = () => {};
export const setScene = () => {};
export const clearLog = () => {};

// The `?level=<id>` part of the page address: which level a shared link
// asks for, and keeping it up to date so the current level can be shared.
//
// Takes the location and history it needs, so tests can pass plain objects.
export class LevelUrl {
  private static readonly PARAM = 'level';

  constructor(
    private readonly location: Pick<Location, 'href' | 'search'>,
    private readonly history: Pick<History, 'replaceState'>,
  ) {}

  // The level id in the address, or null if there is none.
  requested(): string | null {
    return new URLSearchParams(this.location.search).get(LevelUrl.PARAM);
  }

  // Put `id` in the address without adding a history entry.
  remember(id: string): void {
    const url = new URL(this.location.href);
    url.searchParams.set(LevelUrl.PARAM, id);
    this.history.replaceState(null, '', url);
  }
}

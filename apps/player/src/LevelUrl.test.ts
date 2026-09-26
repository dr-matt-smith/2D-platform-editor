import { assertEquals } from '@std/assert';
import { LevelUrl } from './LevelUrl.ts';

// A location and history pair that records replaceState calls.
function fakePage(href: string) {
  const url = new URL(href);
  const replaced: string[] = [];
  const location = { href: url.href, search: url.search };
  const history = {
    replaceState: (_data: unknown, _unused: string, next?: string | URL | null) => {
      replaced.push(String(next));
    },
  };
  return { levelUrl: new LevelUrl(location, history), replaced };
}

Deno.test('requested() reads ?level from the address', () => {
  assertEquals(fakePage('http://x/apps/player/?level=tutorial').levelUrl.requested(), 'tutorial');
  assertEquals(fakePage('http://x/apps/player/').levelUrl.requested(), null);
});

Deno.test('remember() replaces ?level and keeps the rest of the address', () => {
  const { levelUrl, replaced } = fakePage('http://x/apps/player/?level=a&debug=1#top');
  levelUrl.remember('b');
  assertEquals(replaced, ['http://x/apps/player/?level=b&debug=1#top']);
});

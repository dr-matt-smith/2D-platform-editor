import { assertEquals } from '@std/assert';
import { escapeHtml } from './escapeHtml.ts';

Deno.test('escapeHtml neutralises markup and both quote styles', () => {
  assertEquals(
    escapeHtml(`<img src=x onerror="alert('hi')">&`),
    '&lt;img src=x onerror=&quot;alert(&#39;hi&#39;)&quot;&gt;&amp;',
  );
});

Deno.test('escapeHtml leaves plain text alone and stringifies non-strings', () => {
  assertEquals(escapeHtml('below_ground'), 'below_ground');
  assertEquals(escapeHtml(42), '42');
});

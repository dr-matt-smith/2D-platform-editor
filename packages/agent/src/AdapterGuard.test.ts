import { assertThrows } from '@std/assert';
import { JsPhysicsAdapter, jsAdapter } from '@2d-platform/engine';
import { AdapterGuard } from './AdapterGuard.ts';
import { LevelTester } from './LevelTester.ts';
import { PlannerFactory } from './PlannerFactory.ts';
import type { PhysicsAdapter } from './PhysicsAdapter.ts';

// A JavaScript caller (or a bridge) can pass no adapter at all.
const MISSING = null as unknown as PhysicsAdapter;

// An adapter that shipped the editor's display TILE=24 instead of the
// engine's TILE=20 must be rejected loudly.
class WrongTileAdapter extends JsPhysicsAdapter {
  override readonly TILE = 24;
}

Deno.test('AdapterGuard.assert accepts the engine adapter', () => {
  AdapterGuard.assert(jsAdapter, 'test');
});

Deno.test('AdapterGuard.assert throws when the adapter is missing', () => {
  assertThrows(() => AdapterGuard.assert(null, 'test'), Error, 'adapter is required');
  assertThrows(() => AdapterGuard.assert(undefined, 'test'), Error, 'adapter is required');
});

Deno.test('AdapterGuard.assert throws when adapter.TILE mismatches the agent TILE', () => {
  assertThrows(() => AdapterGuard.assert(new WrongTileAdapter(), 'test'), Error, 'does not match');
});

Deno.test('planners and testers check their adapter when they are made', () => {
  assertThrows(() => PlannerFactory.create(MISSING), Error, 'adapter is required');
  assertThrows(() => PlannerFactory.create(new WrongTileAdapter()), Error, 'does not match');
  assertThrows(() => LevelTester.create(MISSING), Error, 'adapter is required');
  assertThrows(() => LevelTester.create(new WrongTileAdapter()), Error, 'does not match');
});

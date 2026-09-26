import { assertEquals } from '@std/assert';
import { Legend, Level } from '@2d-platform/level-format';
import { jsAdapter } from '@2d-platform/engine';
import { NavGraph } from './NavGraph.ts';
import { PickupTour } from './PickupTour.ts';

// The agent takes legends as plain records.
const DEFAULT_LEGEND = Legend.DEFAULT.toRecord();

const graphOf = (text: string) => NavGraph.build(jsAdapter, Level.parse(text), DEFAULT_LEGEND);

Deno.test('resolve: no exit → no goals', () => {
  assertEquals(PickupTour.resolve(graphOf('#####\n#Po.#\n#####'), 'all'), []);
});

Deno.test('resolve: none required → straight to the exit', () => {
  assertEquals(PickupTour.resolve(graphOf('#######\n#P.o.E#\n#######'), 0), ['1,5']);
});

Deno.test('resolve: all of a row of pickups, visited end to end, then the exit', () => {
  // Exhaustive ordering (4 pickups) walks the row left to right.
  const goals = PickupTour.resolve(graphOf('##########\n#P.oooo.E#\n##########'), 'all');
  assertEquals(goals, ['1,3', '1,4', '1,5', '1,6', '1,8']);
});

Deno.test('resolve: N of M picks the cheapest N', () => {
  // One of three required: the nearest one.
  assertEquals(PickupTour.resolve(graphOf('##########\n#Po.o.o.E#\n##########'), 1), ['1,2', '1,8']);
});

Deno.test('resolve: more than 4 pickups uses nearest-first + 2-opt and still visits them all', () => {
  const goals = PickupTour.resolve(graphOf('##############\n#Pooooo.....E#\n##############'), 'all');
  assertEquals(goals, ['1,2', '1,3', '1,4', '1,5', '1,6', '1,12']);
});

Deno.test('resolve: unreachable pickups are left out', () => {
  // The pickup behind the wall has no path; the exit is still a goal.
  const goals = PickupTour.resolve(graphOf('########\n#P.E#.o#\n########'), 'all');
  assertEquals(goals, ['1,3']);
});

# PickupRequirement

`packages/level-format/src/PickupRequirement.ts` · class

The `# pickup-required:` rule: how many pickups the player must collect
before touching an exit wins. One class holds the rule so the editor's Play
Settings dialog, the level text setter and the engine's win check all agree.

## Relationships
- wraps a `PickupRequired` value (`'all' | number`), the form stored in [LevelMeta](LevelMeta.md)
- returned by [Level](Level.md)`.pickupRequirement`
- used by [LevelText](LevelText.md)`.setPickupRequired` and by the engine's playtest scene

## Members
| Member | Kind | Description |
|---|---|---|
| `ALL` | static readonly | The default rule: every pickup |
| `new PickupRequirement(required?)` | constructor | `'all'` (default), `0` (no minimum) or a count |
| `required` | readonly property | The wrapped value |
| `parseValue(text)` | static method | Read a directive value: `'all'` or a whole number, else `null` |
| `isMetBy(score, total)` | method | Has the player collected enough to win at an exit? |
| `directiveValue()` | method | The text to write after `# pickup-required:`, or `null` to omit the line |

`isMetBy` rules: `'all'` needs every pickup; `0` (or a negative number)
needs none; `N` needs `min(N, total)`, so asking for more pickups than the
level has means "all of them"; a non-finite count behaves like `'all'`.

## Example
```ts
import { PickupRequirement } from '@2d-platform/level-format';

new PickupRequirement(2).isMetBy(2, 5);    // true
new PickupRequirement(10).isMetBy(4, 4);   // true — clamped to the 4 there are
PickupRequirement.ALL.isMetBy(3, 4);       // false
PickupRequirement.parseValue('3');         // 3
new PickupRequirement('all').directiveValue(); // null — the default is not written
```

## Design notes
- **Value object.** A small immutable object that wraps a primitive and
  gives it behaviour. The level keeps the primitive (`'all' | number`)
  because that is what is stored and what the agent package reads; code
  that needs the *rule* wraps it.
- **Behaviour next to its data.** Parsing the directive, writing it and
  applying it all live in one class instead of three places.

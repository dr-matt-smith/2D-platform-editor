# SpriteAnimation

`packages/render/src/SpriteAnimation.ts` · class

A [SpriteStrip](SpriteStrip.md) played on a loop at `fps` frames per second.
It has no clock of its own: the frame is worked out from the time passed in.

## Relationships
- implements [Sprite](Sprite.md)
- has a [SpriteStrip](SpriteStrip.md) (composition) and returns its [DrawSpec](DrawSpec.md)s
- created by [SpriteStrip](SpriteStrip.md)`.toSprite`

## Members
| Member | Kind | Description |
|---|---|---|
| `new SpriteAnimation(strip, fps)` | constructor | Usually made by `SpriteStrip.toSprite` |
| `strip` | readonly property | The frames |
| `fps` | readonly property | Frames per second (> 0) |
| `frameAt(now?)` | method | Frame `floor(now × fps / 1000) mod frames`; a missing, negative or `NaN` time counts as 0 |

## Example
```ts
const anim = new SpriteAnimation(new SpriteStrip(image, 4), 25);  // 40 ms a frame
anim.frameAt(0).sx;     // 0
anim.frameAt(40).sx;    // one frame width
anim.frameAt(160).sx;   // 0 again — it loops
```

## Design notes
- **Stateless.** Because the frame is a pure function of `now`, the editor
  (which passes no time) always shows frame 0, the playtest animates from
  `performance.now()`, and tests can ask about any moment.
- **Polymorphism.** It is used anywhere a [Sprite](Sprite.md) is, exactly
  like a still [DrawSpec](DrawSpec.md).

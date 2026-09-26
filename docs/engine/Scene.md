# Scene

`packages/engine/src/Scene.ts` · abstract class

One screen of the game. The [Game](Game.md) calls its lifecycle hooks:
`enter()` when it becomes active, `exit()` when replaced, and `update(dt)`
then `draw(ctx)` every frame.

## Relationships
- extended by [PlaytestScene](PlaytestScene.md)
- holds a [SceneHost](SceneHost.md) as `game` (usually a [Game](Game.md))
- hosted by [Game](Game.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `new Scene(game)` | constructor | Remember the host |
| `game` | readonly property | The [SceneHost](SceneHost.md): input and sounds |
| `enter()` | method | Setup when the scene becomes active (does nothing by default) |
| `exit()` | method | Teardown when it is replaced (does nothing by default) |
| `update(dt)` | abstract method | One frame of logic, `dt` seconds long |
| `draw(ctx)` | abstract method | One frame of drawing |

## Example
```ts
class TitleScene extends Scene {
  update(): void {
    if (this.game.input.wasPressed(Key.Space)) { /* start */ }
  }
  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillText('Press space', 10, 10);
  }
}
```

## Design notes
- **Template of hooks.** The game loop is written once against `Scene`;
  each scene fills in the hooks. Optional hooks get empty defaults, required
  ones are `abstract`, so the compiler reports a scene that forgets to draw.
- **Depends on an interface, not the class.** `game` is a
  [SceneHost](SceneHost.md), not a [Game](Game.md), so the same scene runs
  headless for the agent with a plain object as its host.

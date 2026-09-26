# Splitter

`apps/editor/src/Splitter.ts` · abstract class

A draggable bar that resizes part of the page. Dragging sets a CSS custom
property on the document root (which the stylesheet reads), releasing saves
the size, and double-clicking resets it. The drag is written once here;
subclasses say which axis, which property and what "reset" means.

## Relationships
- extended by [PaneSplitter](PaneSplitter.md) and [ProblemsSplitter](ProblemsSplitter.md)
- saves to a [KeyValueStore](KeyValueStore.md); configured by [SplitterOptions](SplitterOptions.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `clampPx(px, minA, minB, viewport)` | static method | Clamp a size so neither side drops below its minimum |
| `resolve(options)` | protected static method | Fill in the real document, window and storage |
| `listen()` | protected method | Apply the initial size and attach the pointer handlers |
| `savedSize()` | protected method | The stored size, or null |
| `restore()` | protected abstract method | Apply the saved (or default) size |
| `sizeAt(e)` | protected abstract method | The size for a pointer position |
| `applySize(px)` | protected abstract method | Set the CSS property |
| `measure()` | protected abstract method | The rendered size, to save |
| `resetSize()` | protected abstract method | What a double-click does after clearing storage |

## Example
```ts
class SidebarSplitter extends Splitter {
  protected restore() { /* … */ }
  protected sizeAt(e: PointerEvent) { return e.clientX; }
  protected applySize(px: number) { this.doc.documentElement.style.setProperty('--side', `${px}px`); }
  protected measure() { return 200; }
  protected resetSize() { this.doc.documentElement.style.removeProperty('--side'); }
}
```

## Design notes
**Template method.** The pointer handling (capture, the `dragging` class,
saving on release) is identical for both bars, so it lives once in the base;
the five abstract hooks are the only places they differ. Before the
restructure the two bars were two near-copies of the same function.

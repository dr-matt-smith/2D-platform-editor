# PlatformKind

`packages/engine/src/PlatformKind.ts` · enum

How a [Platform](Platform.md) looks. Both kinds collide identically.

## Relationships
- held by [Platform](Platform.md)`.kind`; [World](World.md) builds `Ground` platforms

## Members
| Member | Value | Meaning |
|---|---|---|
| `Ground` | `'ground'` | A full-tile dark block (terrain cells) |
| `Platform` | `'platform'` | A lighter block with an outline |

## Example
```ts
new Platform(0, 40, 200, 20, PlatformKind.Ground);
```

## Design notes
Two named variants read better than a boolean, and a third could be added
without changing the constructor's signature.

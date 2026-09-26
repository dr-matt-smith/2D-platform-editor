# EditorTheme

`apps/editor/src/EditorTheme.ts` · enum

The colour scheme.

## Relationships
- held by [ThemeController](ThemeController.md); saved by [Preferences](Preferences.md)`.theme`; shown by [Toolbar](Toolbar.md)

## Members
| Member | Value | Meaning |
|---|---|---|
| `Dark` | `'dark'` | The default |
| `Light` | `'light'` | `body.lightmode` |

## Example
```ts
toolbar.showTheme(EditorTheme.Light); // 'Theme: light (click for dark)'
```

## Design notes
The values are the strings stored under `v23.theme`.

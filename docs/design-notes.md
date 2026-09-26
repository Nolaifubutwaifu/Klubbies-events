# Design notes

> **Historical.** This describes the v1 Modernist system (tag `design-v1-modernist`). The product now uses the soft theme in `app/globals.css`; the choices behind it are decisions 46 to 79 in `docs/decisions.md`. Kept for the token history.

Source: Claude Design project `Klubbies.dc.html` (Modernist design system). The raw file could not be exported in the build session. Drop it here as `design/Klubbies.dc.html` via Claude Design → download, or `/design-login` + DesignSync. Everything below was extracted from it and is implemented in `tailwind.config.ts` and `app/globals.css`.

## Tokens

- **Font:** Archivo for headings and body. Display headings use weight 900, letter-spacing −0.03em and line-height ~1. Body is 15px / 1.55.
- **Colour:**

  | Token | Value |
  | --- | --- |
  | bg | `#f3f2f2` |
  | surface | `#eae9e9` |
  | text | `#201e1d` |
  | accent | `#ec3013` |
  | accent-2 | `#e15b47` |
  | divider | text at 40% |

  Neutral 100–900: `#f8f4f4 #eae7e7 #d7d3d3 #bab6b6 #9b9797 #7d7979 #605d5d #444141 #2d2b2b`.
  Accent 100–900: `#fff2ef #ffe0d9 #ffc4b8 #ff9783 #ff563c #dd2b0f #ae1800 #7c1405 #4d170e`.
- **Spacing:** 4 / 8 / 12 / 16 / 24 / 32, plus 64 and 72 for hero sections.
- **Shape:** radius 0 everywhere. Sections are separated by 2px divider borders. Tile grids use a 2px gap over the divider colour. Shadows appear only on dialogs.
- **Kicker label:** 12px, weight 700, letter-spacing 0.16em, uppercase, accent-700.

## Mockup screens → routes

| Mockup | Route |
| --- | --- |
| Landing | `/` |
| Member log in | `/signin` (+ `/signin/code`) |
| Club gallery | `/c/[handle]` |
| Viewer | `/c/[handle]/a/[albumId]/[mediaId]` |
| Create club | `/admin/new` |
| Upload | `/admin/[handle]/albums/[albumId]` |
| Member list | `/admin/[handle]/members` |

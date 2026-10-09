# Shelver

A local workspace for composing video game covers with your own artwork.

## Development

Use Node.js 22.13 or newer (Node 22 LTS recommended) and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite (normally http://127.0.0.1:5173).

```sh
npm run typecheck
npm run lint
npm run build
npm run preview
```

Dependencies are pinned in `package.json`; commit `package-lock.json` with dependency changes.

## Current scaffold

- React + TypeScript + Vite, with a Fabric.js canvas.
- English interface as an initial working choice.
- In-memory project library: create, open, rename, and duplicate.
- Generic PC / Steam layout, with back, spine, and front panels.
- Import PNG, JPEG, or WebP artwork; add and edit text; resize, rotate, and remove elements.
- Zoom independent of the 1200 × 800 px PNG export. Panel guides are excluded from export.
- Versioned domain model independent of Fabric serialization, with immutable asset references.

**Projects and artwork are held in memory and disappear when the page reloads or closes.**
Returning to the library preserves them during the current session. Export a PNG before closing.
Library tiles are title placeholders, not rendered thumbnails yet.

The starter uses provisional **digital** dimensions, not validated physical case measurements.
IndexedDB, portable backups, undo/redo, template editing, and print PDF export remain planned.

## Structure

```text
src/
  domain/          Versioned project, template, asset, and element types
  editor/          Fabric adapter and canvas interactions
  App.tsx         Session library and workspace navigation
  styles.css      Application styles
```

See [PLAN.md](PLAN.md) for the roadmap and validation criteria.

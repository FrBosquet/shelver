# Shelver

A local workspace for composing video game covers with your own artwork.

## Development

Use Node.js 22.13 or newer (Node 22 LTS recommended) and npm.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. Development uses a fixed port; if it is occupied, Vite stops instead of silently opening a different local library on another port.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

Dependencies are pinned in `package.json`; commit `package-lock.json` with dependency changes.

## Current implementation

- React + TypeScript + Vite, with a Fabric.js canvas.
- English interface as an initial working choice.
- Local project library: create, open, rename, and duplicate.
- IndexedDB autosave for compositions and artwork, with visible saving, saved, and error states.
- Generic PC / Steam layout, with back, spine, and front panels.
- Import PNG, JPEG, or WebP artwork; add and edit text; resize, rotate, and remove elements.
- Zoom independent of the 1200 × 800 px PNG export. Panel guides are excluded from export.
- Versioned domain model independent of Fabric serialization, with immutable asset references.

Projects and artwork reload from IndexedDB when you reopen the app. Open a saved project from the library to continue editing.
Library tiles are title placeholders, not rendered thumbnails yet.

## Local saving

- Changes are saved automatically after a 300 ms pause. A project and newly imported image blobs commit in the same transaction.
- `Saved locally` appears only after the transaction completes. Pending changes show `Saving…`.
- Failed writes retain your changes in memory and show an error with a retry button. Keep the tab open until saving succeeds; PNG export remains available.
- If the library cannot be read, editing is blocked until loading succeeds. Existing data is not reset or overwritten.
- Closing or reloading with pending changes triggers the browser's unsaved-changes warning. Backgrounding the page starts an immediate save, but forced browser termination can still interrupt pending writes.
- Storage belongs to the exact browser origin (protocol, host, and port). Use the same development URL to reopen the same library: `localhost` and `127.0.0.1`, or different ports, have separate storage.
- This is local saving, not a portable backup or device sync. Clearing browser data, private browsing, or browser storage eviction can remove the library. Portable `.coverproject` backups remain planned.

The version 1 database has separate `projects` and `assets` stores. Asset blobs are immutable and can be shared by project copies. Autosave updates only changed projects, rather than replacing the entire library. Simultaneous editing of the same project in multiple tabs is not supported.

`npm test` runs storage and autosave tests with fake-indexeddb, covering reopening with blobs and transforms, independent copies, transactional rollback, edits arriving during saves, quota errors and retries, and failed library loading.

The starter uses provisional **digital** dimensions, not validated physical case measurements.
Portable backups, undo/redo, template editing, and print PDF export remain planned.

## Structure

```text
src/
  domain/          Versioned project, template, asset, and element types
  editor/          Fabric adapter and canvas interactions
  storage/        IndexedDB repository, autosave store, and React subscription
  App.tsx         Local library and workspace navigation
  styles.css      Application styles
```

See [PLAN.md](PLAN.md) for the roadmap and validation criteria.

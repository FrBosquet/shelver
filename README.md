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
- Portable `.coverproject` backups containing the composition and its image files.
- Per-project session undo/redo, including text, transforms, and image changes.

Projects and artwork reload from IndexedDB when you reopen the app. Open a saved project from the library to continue editing.
Library tiles are title placeholders, not rendered thumbnails yet.

## Local saving

- Changes are saved automatically after a 300 ms pause. A project and newly imported image blobs commit in the same transaction.
- `Saved locally` appears only after the transaction completes. Pending changes show `Saving…`.
- Failed writes retain your changes in memory and show an error with a retry button. Keep the tab open until saving succeeds; PNG export remains available.
- If the library cannot be read, editing is blocked until loading succeeds. Existing data is not reset or overwritten.
- Closing or reloading with pending changes triggers the browser's unsaved-changes warning. Backgrounding the page starts an immediate save, but forced browser termination can still interrupt pending writes.
- Storage belongs to the exact browser origin (protocol, host, and port). Use the same development URL to reopen the same library: `localhost` and `127.0.0.1`, or different ports, have separate storage.
- Clearing browser data, private browsing, or browser storage eviction can remove the library. Download a `.coverproject` backup to keep a portable copy; IndexedDB does not sync devices.

The version 1 database has separate `projects` and `assets` stores. Asset blobs are immutable and can be shared by project copies. Autosave updates only changed projects, rather than replacing the entire library. Simultaneous editing of the same project in multiple tabs is not supported.

## Portable backups

Open a project, click **Export project**, then **Save .coverproject** when the backup is ready. Use **Import project** to restore it in this browser or another browser running Shelver. Import creates an independent project with fresh identifiers and saves its composition and images together; existing projects are preserved.

The file is a ZIP containing a versioned JSON manifest and only the images referenced by the current composition. Image bytes are checked against SHA-256 hashes and decoded dimensions before import. Missing files, unsupported versions, external paths, and malformed packages show an error without adding a partial project.

Packages are limited to 100 MiB compressed, 200 MiB expanded, a 2 MiB manifest, and 256 images. Each image can be at most 16,000 pixels per side and 64 megapixels. The current format supports pixel-based canvases. Backups do not contain session history.

## Undo and redo

Use the toolbar or **Ctrl/Cmd+Z** and **Ctrl/Cmd+Shift+Z**; **Ctrl/Cmd+Y** also redoes. Text fields retain their native editing shortcuts. Each project keeps up to 100 undo steps during the session. Consecutive name or text edits within 750 ms are grouped.

Undo and redo autosave the restored composition, preserve zoom, and clear the canvas selection. New edits discard the redo branch. History resets when the app reloads. Immutable image blobs are retained so an earlier image can be restored.

`npm test` covers storage, autosave, session history, package validation, and restoring backups into an empty database, including binary artwork and independent imported copies.

The starter uses provisional **digital** dimensions, not validated physical case measurements.
Template editing and print PDF export remain planned.

## Structure

```text
src/
  domain/          Versioned project, template, asset, and element types
  editor/          Fabric adapter and canvas interactions
  packages/        Portable ZIP export, validation, and import
  storage/        IndexedDB repository, autosave store, and React subscription
  App.tsx         Local library and workspace navigation
  styles.css      Application styles
```

See [PLAN.md](PLAN.md) for the roadmap and validation criteria.

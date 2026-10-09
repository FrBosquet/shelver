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
- Steam editorial template based on the supplied cover reference, plus the original free composition starter.
- Import PNG, JPEG, or WebP artwork; add and edit text; resize, rotate, and remove elements.
- Zoom independent of PNG export at the composition's dimensions. Panel guides are excluded from export.
- Versioned domain model independent of Fabric serialization, with immutable asset references.
- Portable `.coverproject` backups containing the composition and its image files.
- Per-project session undo/redo, including text, transforms, and image changes.

Projects and artwork reload from IndexedDB when you reopen the app. Open a saved project from the library to continue editing.
Library tiles are title placeholders, not rendered thumbnails yet.

## Trying the Steam template

In the library, choose **Create Steam cover**. The template includes a platform header, configurable spine, game identity, headline/synopsis, screenshot gallery, review quote, two-column PC requirements, feature cells, rating/descriptors, publisher/legal footer and an editable QR code. Enter an HTTP or HTTPS URL in the QR controls to regenerate it automatically; older barcode blocks are replaced by the default Steam QR.

Use the **Blocks** tab to edit content, hide blocks, adjust their position/size and upload PNG/JPEG/WebP images into individual slots. Screenshot images fill their frame without distortion and have focal-point controls; logos fit within their slots. The title, publisher identity and rating are shared across their appearances. An uploaded rating badge is reset when its rating changes so matching artwork can be supplied.

Use **Styles** for shared colors, system-font families and text styles. Editing a caption style updates its users. Editing a selected canvas text's color/font/content creates an individual override; **Restore shared style & layout** or the block reset button restores inheritance. The Steam logo is bundled as actual SVG artwork. Game/publisher logos, illustrations, descriptor icons and fonts still need individual assets, so their slots use placeholders and system fonts.

Use **Logos** in any editor to add a shared Steam logo or symbol, in white or black. The Steam template uses the full logo automatically in the header and spine, choosing the variant that contrasts with each background; the **Steam logo source** control chooses an explicit variant or restores automatic contrast. Uploaded custom logos still take precedence. Shared SVG files are bundled locally with stable versioned IDs, preserve their proportions and are included in `.coverproject` backups. SVG backup support currently covers the bundled logo library; custom image uploads remain PNG/JPEG/WebP. Asset provenance is recorded in [src/assets/logos/README.md](src/assets/logos/README.md).

Use **Format** to select a working geometry or enter face width, height and spine width. The Steam style stays the same while blocks reflow, slots recrop and manual element positions adapt relative to their panels. New free text/images participate in adaptation. Format changes, template edits and image replacement support autosave and undo/redo. Text areas that exceed their allotted space show a warning for review.

These are provisional digital geometries, not measured physical cases. The initial component layouts are intended for testing and refinement; very narrow or unusually proportioned formats may need block adjustments. Creating arbitrary nested block types, custom font uploads and saving new named templates remain planned.

## Local saving

- Changes are saved automatically after an 800 ms pause. Slider drags and held adjustment keys suspend autosave until release, cancellation, loss of focus, or leaving the editor, then start the debounce. The preview updates immediately. A project and newly imported image blobs commit in the same transaction.
- `Saved locally` appears only after the transaction completes. Waiting changes show `Changes pending`; `Saving…` appears during a write. Edits made during autosave keep their own debounce.
- Failed writes retain your changes in memory and show an error with a retry button. Keep the tab open until saving succeeds; PNG export remains available.
- If the library cannot be read, editing is blocked until loading succeeds. Existing data is not reset or overwritten.
- Closing or reloading with pending changes triggers the browser's unsaved-changes warning. Backgrounding the page starts an immediate save, but forced browser termination can still interrupt pending writes.
- Storage belongs to the exact browser origin (protocol, host, and port). Use the same development URL to reopen the same library: `localhost` and `127.0.0.1`, or different ports, have separate storage.
- Clearing browser data, private browsing, or browser storage eviction can remove the library. Download a `.coverproject` backup to keep a portable copy; IndexedDB does not sync devices.

The version 1 database has separate `projects` and `assets` stores. Asset blobs are immutable and can be shared by project copies. Autosave updates only changed projects, rather than replacing the entire library. Simultaneous editing of the same project in multiple tabs is not supported.

New projects use domain schema version 2. Steam projects store a versioned design definition with blocks, shared styles, slot references, individual overrides and panel-relative placements alongside the resolved composition. Version 1 projects remain readable without replacing their data; the database stores themselves do not need a schema upgrade.

## Portable backups

Open a project, click **Export project**, then **Save .coverproject** when the backup is ready. Use **Import project** to restore it in this browser or another browser running Shelver. Import creates an independent project with fresh identifiers and saves its composition and images together; existing projects are preserved.

The file is a ZIP containing a versioned JSON manifest and the images referenced by the current composition and design, including hidden blocks. It retains editable block definitions, shared styles and overrides. New packages use schema version 2; version 1 backups can still be imported. Image bytes are checked against SHA-256 hashes and decoded dimensions before import. Missing files, unsupported versions, external paths, and malformed packages show an error without adding a partial project.

Packages are limited to 100 MiB compressed, 200 MiB expanded, a 2 MiB manifest, and 256 images. Each image can be at most 16,000 pixels per side and 64 megapixels. The current format supports pixel-based canvases. Backups do not contain session history.

## Undo and redo

Use the toolbar or **Ctrl/Cmd+Z** and **Ctrl/Cmd+Shift+Z**; **Ctrl/Cmd+Y** also redoes. Text fields retain their native editing shortcuts. Each project keeps up to 100 undo steps during the session. Consecutive name or text edits within 750 ms are grouped.

Undo and redo autosave the restored composition, preserve zoom, and clear the canvas selection. New edits discard the redo branch. History resets when the app reloads. Immutable image blobs are retained so an earlier image can be restored.

`npm test` covers storage, autosave, session history, package validation, shared styles and overrides, linked content, format adaptation, legacy compatibility and restoring editable templates and artwork into an empty database.

The starter uses provisional **digital** dimensions, not validated physical case measurements.
Additional platform styles, saving custom templates and print PDF export remain planned.

## Structure

```text
src/
  domain/          Versioned models, Steam blocks, styles and composition resolution
  editor/          Fabric adapter, canvas interactions and template inspector
  packages/        Portable ZIP export, validation, and import
  storage/        IndexedDB repository, autosave store, and React subscription
  App.tsx         Local library and workspace navigation
  styles.css      Application styles
```

See [PLAN.md](PLAN.md) for the roadmap and validation criteria.

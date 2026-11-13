# Native Excalidraw whiteboards in AFFiNE

The active Whiteboard feature is part of AFFiNE's React workbench. It uses no
iframe, second React root, hosted editor, or separate whiteboard database.
The earlier prototype files in this directory are retained only as an inactive
rollback reference. They are not imported or required by the native integration;
do not run their separate npm build to build the current feature.

## Repository analysis and dependency decision

AFFiNE is a Yarn 4 monorepo running React 19.2.1 and Rspack. Desktop workspace
routes live in `packages/frontend/core/src/desktop/workbench-router.ts`.
`DocsService` creates and opens BlockSuite documents; each document has a Yjs
`spaceDoc`, and the workspace engine handles local storage and synchronization.
Document metadata and properties are already indexed and used by navigation,
search, permissions, recent documents, duplication, and Trash.

The supplied Excalidraw repository was inspected, including its reusable React
component, public imperative API, serializer, restoration, reconciliation,
styles, fonts, package exports, and MIT license. The supported published
`@excalidraw/excalidraw` package is pinned to **0.18.0**. Its React peer range
explicitly supports React 19. Using the package avoids maintaining source aliases,
a second dependency tree, a custom build, or patches to editor internals. The
sibling source checkout is not needed to build the native integration.

Excalidraw retains its drawing toolbar and native editing interactions. The
existing AFFiNE Page and Edgeless editors continue to handle ordinary documents.
The MIT copyright and license are served as `/LICENSE-Excalidraw.txt`; fonts are
copied from the pinned package into the normal build at `/excalidraw/fonts/`.

## Workspace, routing, and management

- Whiteboard in the existing sidebar opens a workspace-scoped board list.
- New boards are ordinary AFFiNE documents marked by the custom property
  `affine:excalidraw = "1"`. Their normal document URLs open the native editor.
- The list supports title search, rename, duplicate, and recoverable deletion.
- Recent ordering and badges reuse AFFiNE's `RecentDocsService` (the existing
  service retains the last three documents, including notes).
- Boards also appear in All docs and normal title search. Native AFFiNE document
  references can link to them by their ordinary document IDs.
- `DetailPageWrapper` supplies the existing permission and document-loading
  context. Read, update, trash, duplicate, and workspace creation guards are used.
- Deletion and restoration use the existing document lifecycle and Trash UI.
  A trashed board opens read-only and retains its data and images.

## Storage and reliability

`modules/whiteboard/scene.ts` stores scene data in the document's existing Yjs
map `affine:excalidraw:v1`. Each element and image has its own entry. Canvas
settings and the shape library are also stored in that map. Element IDs,
versions, indices, deleted-element tombstones, geometry, styling, and metadata
are retained. Transient editor state and the user's application theme are excluded.

Yjs updates go through AFFiNE's existing document engine. There is no independent
storage service or database. Images are embedded as Excalidraw binary-file data
in the same document, making a saved scene self-contained across offline use,
duplication, trash recovery, and synchronization. Unchanged images are not
re-serialized or rewritten for every drawing update. The tradeoff is larger
Yjs documents for image-heavy boards, which remain subject to AFFiNE's existing
document/storage limits. This implementation does not claim unlimited board size.

Autosave batches edits after 200 ms, with a one-second maximum interval during
continuous drawing. It ignores changes to transient UI state. Navigation flushes
the latest scene and waits for AFFiNE to confirm its local write before leaving
the canvas; edits made while waiting are also flushed. Disposed workspaces cannot
resume a stale asynchronous navigation. Refresh/unload and visibility changes
flush pending changes, and unload warns while a local write remains unconfirmed.
A delayed storage confirmation is surfaced after 15 seconds. Failed scene commits
retain the latest snapshot for retry. Backup exports remain available even if
saving fails.

The editor waits for AFFiNE's document load before reading a scene, and an error
boundary protects the workspace shell. Remote document updates are observed and
reconciled using Excalidraw's supported API. This supplies scene synchronization;
live collaboration cursors and presence are not added.

The previous prototype's browser-local board can be imported using **Import
previous local whiteboard** when detected in the current workspace. The old
IndexedDB store is read only and is never cleared or overwritten. The migration
records completion only after AFFiNE confirms the new document's local write.

## Editor and exports

The editor is lazy loaded only for a whiteboard document. Its keyboard handlers
are scoped to its focused container. AFFiNE's theme controls the editor without
reloading it. The canvas fills the existing content area and responds to sidebar
resizing. Excalidraw's own drawing, text, image, selection, undo/redo, import,
clipboard, and export features remain available.

The AFFiNE header menu additionally provides import and JSON/PNG/SVG downloads
through Excalidraw's supported `loadFromBlob`, `serializeAsJSON`, `exportToBlob`,
and `exportToSvg` APIs. These downloads also work in the in-app browser without
requiring a native filesystem save dialog. PNG/SVG exports include their referenced
image files; JSON is an ordinary portable `.excalidraw` document.

## Changed files

- `packages/frontend/core/package.json`, `yarn.lock`: pinned React editor package.
- `components/root-app-sidebar/index.tsx`: native list link and active-board state.
- `desktop/workbench-router.ts`: lazy workspace list route.
- `desktop/pages/workspace/whiteboard/`: list, native editor, shell styling.
- `desktop/pages/workspace/detail-page/detail-page.tsx`: dispatch marked documents
  to the lazy native editor; retain Page/Edgeless rendering for other documents.
- `modules/whiteboard/scene.ts`: Yjs scene storage, library, duplication support.
- `modules/whiteboard/autosave.ts`: batching, flush, latest-scene retry.
- `modules/whiteboard/navigation.ts`: wait for durable writes before navigation.
- `modules/whiteboard/legacy.ts`: read-only import from the prior prototype.
- `modules/whiteboard/scene.spec.ts`: storage, merge, duplication, autosave, and
  navigation failure/lifecycle regression tests.
- `modules/doc/services/docs.ts`: preserve native board data in ordinary duplicate
  and create-from-template operations.
- `tools/cli/src/rspack/index.ts`: self-host the package's font assets.
- `packages/frontend/core/public/LICENSE-Excalidraw.txt`: MIT attribution.

## Build and verification

Use the normal AFFiNE dependency install and web build; no integration-specific
npm install or editor build is required:

```powershell
corepack yarn install --immutable
corepack yarn affine web dev
corepack yarn affine web build
corepack yarn tsc -b packages/frontend/core --pretty false
corepack yarn vitest run packages/frontend/core/src/modules/whiteboard/scene.spec.ts
```

On this 8 GB development machine, the local launch/build scripts in ignored `tmp/`
limit concurrent Rspack worker bundles and Rayon threads. They call the same
`BundleCommand` used by the normal CLI.

Verification performed on 27 October 2026:

- Development compilation and production compilation of the web app and workers.
- TypeScript project build for `@affine/core` and its references.
- Repository Oxlint rules, including type-aware rules, on the changed code.
- Repository Oxfmt formatting on the changed code.
- Persistence/autosave/navigation tests in `scene.spec.ts`.
- In-app browser: create, draw rectangle/arrow/freehand/text, rename, navigate away,
  reopen, refresh, title search, recent badges, JSON/PNG/SVG downloads, import an
  Excalidraw file with a 2.4 MB embedded image, reopen/refresh that image, paste an
  image, delete the pasted image, keyboard tool selection, undo/redo, duplicate,
  move to Trash, restore, light/system-dark themes, and existing Page/Edgeless views.
- Exported JSON was inspected: it retained the four drawn elements and the
  imported image/file data after reopening and refresh.

Production compilation reports the application's asset and entrypoint size
warnings. Excalidraw is lazy loaded, but it remains a substantial editor bundle.

Cloud authentication and cross-device synchronization were **not** exercised
end-to-end: this local session has no backend listening on port 3010. The feature
uses the existing sync/permission pipeline; passing local tests is not proof of a
cloud deployment. Browser/OS native file-picker automation was unavailable in the
in-app browser; import and image insertion were verified through the supported
header importer and clipboard instead. Existing note content was not modified.

Live inline Excalidraw canvases inside BlockSuite page blocks and public-share
page rendering are not part of this integration. Standard AFFiNE document links
open the native board in the desktop workbench; existing inline preview/export
formats may only show the document title. Use `.excalidraw`, PNG, or SVG for a
portable drawing export.

# Native Kafene dashboards

Kafene dashboards are ordinary AFFiNE pages. Agents compose pages from the editor's own headings, paragraphs, callouts, to-dos, dividers, and databases. The database has an editable table view and can have a calendar view. There is no custom dashboard route, card renderer, or HTML template.

## Local architecture

- `packages/frontend/core/src/modules/native-template/page.ts` validates a small block schema and writes real BlockSuite blocks into a Kafene document.
- `packages/frontend/core/src/modules/native-template/agent-bridge.tsx` runs inside the Kafene workspace and uses `DocsService` to read and edit documents.
- `kafene-desktop/main.cjs` queues local agent commands on `127.0.0.1:49327` and returns the editor's results. It rejects cross-origin writes.
- `kafene-desktop/native-mcp-server.cjs` exposes this bridge to Codex and Claude as stdio MCP tools. Kafene copies the server into `%APPDATA%\Kafene\mcp` on launch.

The guide tool tells agents how to build a concise, human-editable page. The create tool can build a whole page in one call. Read, append, to-do update, and database row creation/update tools support later changes, including checking Done and recording Score. All writes go through the same workspace document store as manual edits. The AI clients can be online; the Kafene workspace remains local unless a client sends page content to its model.

## CAT 2026 example

`kafene-desktop/seed-native-cat.cjs` converts the backed-up CAT study tasks to one native page titled **CAT 2026 · Study dashboard**. It uses a start section, a table/calendar with 68 study actions, a live percent-checked footer, a mock score log, a review checklist, and an exam-day callout. It checks for an existing page before creating one. Completed items and later manual changes are therefore preserved on reruns.

## Verification

Run the core TypeScript build and production web bundle. Launch the packaged app, run the seed script, then inspect the page in the normal Kafene editor. Confirm the table/calendar is editable and to-do state persists after restart. Use the MCP tools to read the same native page.

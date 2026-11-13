# Kafene for Windows

Kafene is an independent Windows workspace for notes, databases, and whiteboards. It serves its bundled files on 127.0.0.1:49327 and stores documents in its local Electron profile. The port must be available at startup. Use export and import to move content between Kafene and browser profiles.

Agents can build and edit pages through the bundled local MCP server. See the [MCP setup guide](https://kafene-desktop.yashwork0055.chatgpt.site/docs/) for Windows instructions for Codex and Claude.

The installer is an unsigned Windows installer. Windows may show an unrecognized-publisher warning. Review and sign releases before distributing them to other users.

To make the Windows x64 installer, run this from `kafene-desktop` with Node.js 22 and npm 10:

```powershell
$env:KAFENE_WEB_DIR = 'C:\path\to\existing\web\dist'
npm.cmd ci
npm.cmd run make:win
```

Build the workspace from the repository root with `PUBLIC_PATH=/` and `corepack yarn affine bundle -p '@affine/web'`. Set `KAFENE_WEB_DIR` to the resulting `packages/frontend/apps/web/dist` directory. If the variable is unset, Forge uses `kafene-desktop/web`. Forge stages a copy of the build. If the Electron ZIP is already available locally, set `KAFENE_ELECTRON_ZIP_DIR` to the directory containing `electron-v41.10.7-win32-x64.zip`. Set `ELECTRON_SKIP_BINARY_DOWNLOAD=1` before `npm ci` to use this installer-only workflow.

Forge writes `Kafene-Setup.exe`, the Squirrel package, and its `RELEASES` file under `out/make/squirrel.windows/x64/`. The coffee cup icon is embedded in the app and installer and is used by the app window and Windows shortcuts. To regenerate it, use Python with Pillow 11.0.0 and run `python scripts/generate-icon.py`.

The packaged app carries the original AFFiNE and Excalidraw license files in `resources/app.asar` under `licenses/`. The installer also retains Electron's `LICENSE` and Chromium's `LICENSES.chromium.html`. Web assets and their existing notices are copied as supplied.

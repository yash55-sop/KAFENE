const fs = require('node:fs/promises');
const path = require('node:path');

const icon = path.join(__dirname, 'assets', 'kafene.ico');
const webSource = process.env.KAFENE_WEB_DIR
  ? path.resolve(process.env.KAFENE_WEB_DIR)
  : path.join(__dirname, 'web');
const notices = [
  ['LICENSE-AFFiNE.txt', '../LICENSE'],
  ['LICENSE-AFFiNE-MIT.txt', '../LICENSE-MIT'],
  ['LICENSE-Excalidraw.txt', '../packages/frontend/core/public/LICENSE-Excalidraw.txt'],
];

module.exports = {
  packagerConfig: {
    name: 'Kafene',
    executableName: 'Kafene',
    appBundleId: 'app.kafene.desktop',
    asar: true,
    icon,
    electronZipDir: process.env.KAFENE_ELECTRON_ZIP_DIR,
    win32metadata: {
      CompanyName: 'Kafene',
      FileDescription: 'Kafene productivity workspace',
    },
    ignore: [
      /^\/(?!assets(?:\/|$)|(?:main\.cjs|native-mcp-server\.cjs|package\.json)$).+/,
    ],
  },
  hooks: {
    async prePackage() {
      const entry = await fs.stat(path.join(webSource, 'index.html')).catch(() => null);
      if (!entry?.isFile()) {
        throw new Error(`No built web entry in ${webSource}. Set KAFENE_WEB_DIR to an existing web dist.`);
      }
    },
    async packageAfterCopy(_config, buildPath) {
      await fs.cp(webSource, path.join(buildPath, 'web'), { recursive: true, dereference: true });
      const licenseDir = path.join(buildPath, 'licenses');
      await fs.mkdir(licenseDir, { recursive: true });
      await Promise.all(notices.map(([filename, source]) =>
        fs.copyFile(path.resolve(__dirname, source), path.join(licenseDir, filename))
      ));
    },
  },
  makers: [{
    name: '@electron-forge/maker-squirrel',
    config: {
      name: 'Kafene',
      setupExe: 'Kafene-Setup.exe',
      setupIcon: icon,
      // Omit NuGet's remote icon field; Windows uses the embedded icons.
      nuspecTemplate: path.join(__dirname, 'scripts', 'kafene.nuspec'),
      copyright: 'Copyright (c) 2022-present TOEVERYTHING PTE. LTD. and its affiliates.',
    },
  }],
};

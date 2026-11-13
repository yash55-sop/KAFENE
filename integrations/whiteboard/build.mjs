import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { build } from 'esbuild';
import { sassPlugin } from 'esbuild-sass-plugin';

const directory = path.dirname(fileURLToPath(import.meta.url));
const repository = path.resolve(directory, '../../../excalidraw');
const revision = 'afa3a653fc5d2b742adcbd5a6063187b056d2419';
const head = execFileSync('git', ['-C', repository, 'rev-parse', 'HEAD'], {
  encoding: 'utf8',
}).trim();
if (head !== revision)
  throw new Error(`Expected drawing engine revision ${revision}, got ${head}`);
const output = path.resolve(
  directory,
  '../../packages/frontend/core/public/whiteboard'
);
const packages = path.join(repository, 'packages');
const alias = {};
for (const name of [
  'common',
  'element',
  'math',
  'utils',
  'laser-pointer',
  'fractional-indexing',
]) {
  alias[`@excalidraw/${name}`] = path.join(packages, name, 'src');
}
alias['@excalidraw/excalidraw'] = path.join(packages, 'excalidraw');

await mkdir(output, { recursive: true });
await build({
  absWorkingDir: directory,
  entryPoints: { board: 'board.jsx' },
  outdir: output,
  publicPath: '/whiteboard/',
  bundle: true,
  splitting: true,
  minify: true,
  format: 'esm',
  target: 'es2022',
  jsx: 'automatic',
  alias,
  nodePaths: [path.join(directory, 'node_modules')],
  assetNames: 'assets/[name]-[hash]',
  chunkNames: 'chunks/[name]-[hash]',
  loader: {
    '.woff2': 'file',
    '.woff': 'file',
    '.ttf': 'file',
    '.wasm': 'dataurl',
  },
  define: {
    'process.env.NODE_ENV': '"production"',
    'import.meta.env': JSON.stringify({
      PROD: true,
      DEV: false,
      MODE: 'production',
      PKG_NAME: '@excalidraw/excalidraw',
      PKG_VERSION: '0.18.0',
      VITE_APP_ENABLE_TRACKING: 'false',
    }),
  },
  plugins: [
    {
      name: 'whiteboard-ui-labels',
      setup(builder) {
        // Adapt visible labels at build time; preserve upstream source,
        // file-format identifiers, and license/copyright notices.
        builder.onLoad(
          { filter: /[/\\]locales[/\\]en\.json$/ },
          async ({ path: source }) => ({
            contents: (await readFile(source, 'utf8')).replaceAll(
              'Excalidraw',
              'Whiteboard'
            ),
            loader: 'json',
          })
        );
      },
    },
    sassPlugin({
      quietDeps: true,
      silenceDeprecations: [
        'legacy-js-api',
        'import',
        'global-builtin',
        'color-functions',
        'mixed-decls',
      ],
      // Upstream SCSS imports span sibling packages. Resolve relative @use
      // paths before the Sass plugin moves its compilation entry point.
      precompile(source, sourcePath) {
        return source.replace(
          /(@use|@forward)\s+["'](\.[^"']+)["']/g,
          (match, directive, specifier) => {
            const candidate = path.resolve(path.dirname(sourcePath), specifier);
            for (const extension of ['.scss', '.css', '']) {
              for (const file of [
                candidate + extension,
                path.join(
                  path.dirname(candidate),
                  '_' + path.basename(candidate) + extension
                ),
              ]) {
                if (existsSync(file))
                  return `${directive} "${pathToFileURL(file).href}"`;
              }
            }
            return match;
          }
        );
      },
    }),
  ],
  logLevel: 'info',
});
await cp(path.join(directory, 'index.html'), path.join(output, 'index.html'));
await cp(
  path.join(repository, 'LICENSE'),
  path.join(output, 'LICENSE-Excalidraw.txt')
);
await writeFile(
  path.join(output, 'source.json'),
  JSON.stringify(
    { repository: 'https://github.com/excalidraw/excalidraw', revision },
    null,
    2
  )
);
console.log(`Whiteboard built from ${revision}`);

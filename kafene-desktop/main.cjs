const { app, BrowserWindow, shell } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const PORT = 49327;
const root = path.join(__dirname, 'web');
const icon = path.join(__dirname, 'assets', 'kafene.ico');
if (process.platform === 'win32') app.setAppUserModelId('com.squirrel.Kafene.Kafene');
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.ico':'image/x-icon', '.woff':'font/woff', '.woff2':'font/woff2', '.wasm':'application/wasm', '.webmanifest':'application/manifest+json', '.map':'application/json' };
let server;
const pending = new Map();
const commands = [];
let nextCommandId = 1;
function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1048576) { reject(new Error('Request too large')); req.destroy(); }
    });
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch { reject(new Error('Invalid JSON')); } });
    req.on('error', reject);
  });
}
function isLocalOrigin(req) {
  const origin = req.headers.origin;
  return !origin || origin === `http://127.0.0.1:${PORT}`;
}
async function agentRoute(req, res, pathname) {
  if (!isLocalOrigin(req)) return json(res, 403, { error: 'Invalid origin' });
  if (pathname === '/kafene/agent/commands' && req.method === 'POST') {
    if (req.headers['x-kafene-agent'] !== 'mcp') return json(res, 403, { error: 'Agent header required' });
    try {
      const command = await readJson(req);
      if (!command || typeof command.action !== 'string') return json(res, 400, { error: 'Invalid command' });
      const id = String(nextCommandId++);
      const timeout = setTimeout(() => {
        pending.delete(id);
        const queued = commands.findIndex(item => item.id === id);
        if (queued >= 0) commands.splice(queued, 1);
        if (!res.destroyed) json(res, 504, { error: 'Kafene workspace is not open' });
      }, 30000);
      pending.set(id, { res, timeout });
      commands.push({ id, command });
    } catch (error) { if (!res.destroyed) json(res, 400, { error: error.message }); }
    return;
  }
  if (pathname === '/kafene/agent/next' && req.method === 'GET') {
    if (req.headers['x-kafene-agent'] !== 'renderer') return json(res, 403, { error: 'Renderer header required' });
    return json(res, 200, { commands: commands.splice(0, 20) });
  }
  const match = pathname.match(/^\/kafene\/agent\/results\/(\d+)$/);
  if (match && req.method === 'POST') {
    if (req.headers['x-kafene-agent'] !== 'renderer') return json(res, 403, { error: 'Renderer header required' });
    const item = pending.get(match[1]);
    if (!item) return json(res, 404, { error: 'Command expired' });
    try {
      const result = await readJson(req);
      clearTimeout(item.timeout);
      pending.delete(match[1]);
      json(item.res, result.error ? 400 : 200, result);
      return json(res, 200, { ok: true });
    } catch (error) { return json(res, 400, { error: error.message }); }
  }
  return json(res, 404, { error: 'Unknown agent route' });
}
function openWindow() {
  const window = new BrowserWindow({ width: 1440, height: 900, minWidth: 800, minHeight: 600, title: 'Kafene', icon, backgroundColor: '#171717', webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  window.on('page-title-updated', event => { event.preventDefault(); window.setTitle('Kafene'); });
  window.webContents.setWindowOpenHandler(({url}) => { if (/^https?:\/\//i.test(url)) shell.openExternal(url); return {action:'deny'}; });
  window.webContents.on('will-navigate', (event, url) => { if (!url.startsWith(`http://127.0.0.1:${PORT}/`)) { event.preventDefault(); if (/^https?:\/\//i.test(url)) shell.openExternal(url); } });
  window.loadURL(`http://127.0.0.1:${PORT}/`);
}
const squirrelEvent = process.argv.find(arg => ['--squirrel-install', '--squirrel-updated', '--squirrel-uninstall', '--squirrel-obsolete'].includes(arg));
if (squirrelEvent) {
  const updater = path.resolve(path.dirname(process.execPath), '..', 'Update.exe');
  const executable = path.basename(process.execPath);
  const operation = squirrelEvent === '--squirrel-uninstall' ? '--removeShortcut' : '--createShortcut';
  if (squirrelEvent !== '--squirrel-obsolete' && fs.existsSync(updater)) {
    require('node:child_process').spawn(updater, [operation, executable], { detached: true, stdio: 'ignore' }).unref();
  }
  setTimeout(() => app.quit(), 1000);
} else if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { const window = BrowserWindow.getAllWindows()[0]; if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
  app.whenReady().then(() => {
    const mcpDir = path.join(app.getPath('userData'), 'mcp');
    fs.mkdirSync(mcpDir, { recursive: true });
    fs.copyFileSync(path.join(__dirname, 'native-mcp-server.cjs'), path.join(mcpDir, 'native-mcp-server.cjs'));
    server = http.createServer((req, res) => {
      let pathname;
      try { pathname = decodeURIComponent(new URL(req.url, `http://127.0.0.1:${PORT}`).pathname); } catch { res.writeHead(400).end(); return; }
      if (pathname.startsWith('/kafene/agent/')) { void agentRoute(req, res, pathname); return; }
      if (pathname.startsWith('/api/') || pathname === '/graphql') { res.writeHead(503, {'Content-Type':'application/json'}).end(JSON.stringify({error:'Cloud service unavailable'})); return; }
      const resolved = path.resolve(root, '.' + pathname);
      if (resolved !== root && !resolved.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
      let file = resolved;
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
      res.writeHead(200, { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
    });
    server.on('error', error => { require('electron').dialog.showErrorBox('Kafene could not start', `Local service could not start: ${error.message}`); app.quit(); });
    server.listen(PORT, '127.0.0.1', openWindow);
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => server?.close());
}

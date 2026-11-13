const readline = require('node:readline');

const endpoint = 'http://127.0.0.1:49327/kafene/agent/commands';
const blockSchema = {
  type: 'array',
  description: 'Ordered native AFFiNE blocks. Kinds: heading (text, level 1–3), paragraph, quote, code (text, language), todo (text, checked), bullet, callout (text, emoji, color), divider, database (title, rows, calendar, columns, progress). Database columns can include date, focus, done, score. Set progress true for a live percent checked footer. Database rows accept text, date YYYY-MM-DD, area, done, score.',
  items: { type: 'object' },
};
const tools = [
  { name: 'kafene_native_guide', description: 'Read the native Kafene dashboard design guide before creating an entire dashboard.', inputSchema: { type: 'object', properties: {} } },
  { name: 'kafene_list_pages', description: 'List Kafene workspace pages and native dashboards.', inputSchema: { type: 'object', properties: {} } },
  { name: 'kafene_get_page', description: 'Read the editable native blocks, database columns, and rows of a page.', inputSchema: { type: 'object', properties: { docId: { type: 'string' } }, required: ['docId'] } },
  { name: 'kafene_create_page', description: 'Create a complete editable page in Kafene using native AFFiNE blocks. Use this to build whole dashboards and templates.', inputSchema: { type: 'object', properties: { title: { type: 'string' }, isTemplate: { type: 'boolean' }, blocks: blockSchema }, required: ['title', 'blocks'] } },
  { name: 'kafene_append_blocks', description: 'Append native editable blocks to a Kafene page.', inputSchema: { type: 'object', properties: { docId: { type: 'string' }, blocks: blockSchema }, required: ['docId', 'blocks'] } },
  { name: 'kafene_update_todo', description: 'Mark a native to-do block complete or incomplete.', inputSchema: { type: 'object', properties: { docId: { type: 'string' }, blockId: { type: 'string' }, checked: { type: 'boolean' } }, required: ['docId', 'blockId', 'checked'] } },
  { name: 'kafene_add_database_row', description: 'Add a row to a native database table or calendar.', inputSchema: { type: 'object', properties: { docId: { type: 'string' }, databaseId: { type: 'string' }, text: { type: 'string' }, cells: { type: 'object' } }, required: ['docId', 'databaseId', 'text'] } },
  { name: 'kafene_update_database_row', description: 'Update an existing native database row, including its Done checkbox, Date, Focus, or Score.', inputSchema: { type: 'object', properties: { docId: { type: 'string' }, databaseId: { type: 'string' }, rowId: { type: 'string' }, text: { type: 'string' }, cells: { type: 'object' } }, required: ['docId', 'databaseId', 'rowId'] } },
];
const guide = `Build Kafene pages using only native AFFiNE blocks. Use a strong page title, clear headings, concise explanations, callouts, to-dos, dividers, and native databases when useful. For programming notes use {"kind":"code","text":"package main\\n\\nfunc main() {}","language":"go"}; this creates an editable Kafene code block with syntax highlighting. A database has a table view and optional calendar view. Every row is editable in Kafene. Do not generate HTML, CSS, card JSON, or static progress percentages. Read the existing page before modifying it and preserve user edits. Example callout: {"kind":"callout","text":"Today: 90 minutes of VARC + one DILR set","emoji":"🎯","color":"blue"}. Example database: {"kind":"database","title":"Daily plan","calendar":true,"columns":["date","focus","done"],"progress":true,"rows":[{"text":"Read one RC passage and review errors","date":"2026-11-09","area":"VARC","done":false}]}. The progress footer calculates percent checked from Done. Supported colors: grey, blue, green, yellow, purple, pink. Kafene is offline first; AI client tool calls may share data with online models.`;

async function execute(name, args) {
  if (name === 'kafene_native_guide') return guide;
  const action = name.replace(/^kafene_/, '');
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Kafene-Agent': 'mcp' }, body: JSON.stringify({ action, ...args }) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `Kafene returned ${response.status}`);
  return body;
}

function send(message) { process.stdout.write(JSON.stringify(message) + '\n'); }
const input = readline.createInterface({ input: process.stdin });
input.on('line', async line => {
  let request;
  try { request = JSON.parse(line); } catch { return; }
  if (request.id === undefined) return;
  try {
    let result;
    if (request.method === 'initialize') result = { protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'kafene-native', version: '1.0.0' } };
    else if (request.method === 'tools/list') result = { tools };
    else if (request.method === 'tools/call') {
      const value = await execute(request.params?.name, request.params?.arguments || {});
      result = { content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }] };
    } else throw new Error(`Unknown method: ${request.method}`);
    send({ jsonrpc: '2.0', id: request.id, result });
  } catch (error) {
    if (request.method === 'tools/call') send({ jsonrpc: '2.0', id: request.id, result: { isError: true, content: [{ type: 'text', text: error.message }] } });
    else send({ jsonrpc: '2.0', id: request.id, error: { code: -32603, message: error.message } });
  }
});

import { useRef, useState } from 'react';

const serverFile = 'native-mcp-server.cjs';
const installedPath = String.raw`%APPDATA%\Kafene\mcp\native-mcp-server.cjs`;
const desktopConfigPath = String.raw`%APPDATA%\Claude\claude_desktop_config.json`;
const nodeExample = String.raw`C:\Program Files\nodejs\node.exe`;
const serverExample = String.raw`C:\Users\YOUR_NAME\AppData\Roaming\Kafene\mcp\native-mcp-server.cjs`;
const resolveServer = '$server = Join-Path $env:APPDATA "Kafene\\mcp\\native-mcp-server.cjs"';
const resolveNode = '$node = (Get-Command node.exe -ErrorAction Stop).Source';

const checkSetup = [
  'node.exe --version',
  resolveNode,
  resolveServer,
  '$node',
  '$server',
  'Test-Path -LiteralPath $server -PathType Leaf',
].join('\n');

const codexCommand = [
  resolveNode,
  resolveServer,
  'codex mcp add kafene -- "$node" "$server"',
  'codex mcp list',
].join('\n');

const codexConfig = [
  '[mcp_servers.kafene]',
  `command = '${nodeExample}'`,
  `args = ['${serverExample}']`,
].join('\n');

const claudeCodeCommand = [
  resolveNode,
  resolveServer,
  'claude mcp add --transport stdio --scope local kafene -- "$node" "$server"',
  'claude mcp list',
].join('\n');

const claudeDesktopConfig = JSON.stringify({
  mcpServers: { kafene: { command: nodeExample, args: [serverExample] } },
}, null, 2);

const bridgeCheck = [
  resolveNode,
  resolveServer,
  `'{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | & $node $server`,
].join('\n');

const firstPrompt = 'Use kafene_list_pages to list the pages in my open Kafene workspace. Do not make any changes.';

const contents = [
  ['before-you-start', 'Before you start'],
  ['codex', 'Codex'],
  ['claude-code', 'Claude Code'],
  ['claude-desktop', 'Claude Desktop'],
  ['first-call', 'First call'],
  ['tools', 'Tool reference'],
  ['troubleshooting', 'Troubleshooting'],
];

const toolGroups = [
  {
    title: 'Read',
    tools: [
      ['kafene_native_guide', 'Get the native block design guide before building a dashboard.'],
      ['kafene_list_pages', 'List pages and dashboards in the open workspace.'],
      ['kafene_get_page', 'Read a page’s editable blocks, database columns, and rows by docId.'],
    ],
  },
  {
    title: 'Write',
    tools: [
      ['kafene_create_page', 'Create an editable page from a title and native blocks.'],
      ['kafene_append_blocks', 'Add native blocks to an existing page.'],
      ['kafene_update_todo', 'Mark an existing to-do block complete or incomplete.'],
      ['kafene_add_database_row', 'Add a row to a native database table or calendar.'],
      ['kafene_update_database_row', 'Change an existing row’s text or cells, such as Done, Date, Focus, or Score.'],
    ],
  },
];

function Snippet({ label, children }) {
  const codeRef = useRef(null);
  const [status, setStatus] = useState('');

  async function copy() {
    setStatus('');
    try {
      await navigator.clipboard.writeText(children);
      setStatus('Copied to clipboard.');
    } catch {
      const selection = window.getSelection();
      if (selection && codeRef.current) {
        const range = document.createRange();
        range.selectNodeContents(codeRef.current);
        selection.removeAllRanges();
        selection.addRange(range);
        setStatus('Text selected. Press Ctrl+C to copy.');
      } else {
        setStatus('Select the snippet and press Ctrl+C to copy.');
      }
    }
  }

  return (
    <figure className="docs-snippet">
      <figcaption className="docs-snippet-header">
        <span>{label}</span>{' '}
        <button
          className="docs-copy"
          type="button"
          aria-label={`Copy ${label}`}
          onClick={copy}
        >
          Copy
        </button>{' '}
        <span className="docs-copy-status" role="status">{status}</span>
      </figcaption>
      <pre className="code" tabIndex={0} aria-label={label}><code ref={codeRef}>{children}</code></pre>
    </figure>
  );
}

export default function Docs() {
  return (
    <article className="docs" aria-labelledby="docs-title">
      <header className="docs-hero">
        <p className="docs-kicker eyebrow">Kafene for Windows / Integration guide</p>
        <h1 id="docs-title">Kafene MCP</h1>
        <p className="docs-lede intro">
          Connect Codex or Claude to your open Kafene workspace. Start by listing
          pages, then use the same connection to build dashboards with editable
          headings, checklists, and databases.
        </p>
      </header>

      <nav className="docs-toc" aria-label="On this page">
        <p className="docs-kicker eyebrow">On this page</p>
        <ol>
          {contents.map(([id, label]) => (
            <li key={id}><a href={`#${id}`}>{label}</a></li>
          ))}
        </ol>
      </nav>

      <section className="docs-section" id="before-you-start" aria-labelledby="setup-title">
        <p className="docs-kicker eyebrow">01 / Setup</p>
        <h2 id="setup-title">Before you start</h2>
        <ol>
          <li>Launch the native Windows Kafene app and open the workspace you want the assistant to use. Keep it open while you work.</li>
          <li>Install Node.js 22 or newer for Windows. Open a fresh Windows PowerShell window for the commands below. Use the Windows builds of the clients for this setup; the examples use Windows paths and do not run in WSL.</li>
          <li>Check that Node reports version 22 or higher and that the script check returns <code>True</code>. The two printed paths are the values to use in manual configuration.</li>
        </ol>
        <Snippet label="PowerShell prerequisites">{checkSetup}</Snippet>
        <p>
          On launch, Kafene copies the bundled bridge to <code>{installedPath}</code> by
          default. Use that copy for the Windows app. In the source tree, the bridge
          is <code>AFFiNE/kafene-desktop/{serverFile}</code>.
        </p>
        <aside className="docs-note" aria-labelledby="local-title">
          <h3 id="local-title">Local tools, cloud inference</h3>
          <p>
            The client starts the Node bridge on your PC and talks to it over
            standard input and output (stdio). The bridge forwards workspace
            requests to the desktop app over loopback at <code>127.0.0.1:49327</code>.
            The loopback address is internal to Kafene; configure the client
            with a command and script path.
          </p>
          <p>
            Kafene stores its workspace locally and the bridge needs no API
            key. With a hosted model, the client can send your prompts and tool
            results, including page content, to its model provider for inference.
            These setups do not provide offline AI.
          </p>
        </aside>
      </section>

      <section className="docs-section" id="codex" aria-labelledby="codex-title">
        <p className="docs-kicker eyebrow">02 / Clients</p>
        <h2 id="codex-title">Codex</h2>
        <p>Register Kafene from Windows PowerShell with the Codex CLI:</p>
        <Snippet label="Codex PowerShell setup">{codexCommand}</Snippet>
        <p>
          For manual setup, add this table to <code>~/.codex/config.toml</code>,
          or to <code>.codex/config.toml</code> in a trusted project. Use this
          as an alternative to the command above. Replace the example paths
          with the absolute paths printed during setup and keep the TOML single quotes.
        </p>
        <Snippet label="Codex config.toml">{codexConfig}</Snippet>
        <p>
          Start a fresh Codex session and run <code>/mcp</code> to check for
          Kafene. <a href="https://learn.chatgpt.com/docs/extend/mcp?surface=cli">Official Codex MCP documentation</a>
        </p>
      </section>

      <section className="docs-section" id="claude-code" aria-labelledby="claude-code-title">
        <h2 id="claude-code-title">Claude Code</h2>
        <p>
          Run this in Windows PowerShell from the project where you use Claude
          Code. The <code>local</code> scope is personal to that project. Use{' '}
          <code>--scope user</code> if you want Kafene in all your projects.
        </p>
        <Snippet label="Claude Code PowerShell setup">{claudeCodeCommand}</Snippet>
        <p>
          Open a Claude Code session in that project and check <code>/mcp</code>.
          {' '}<a href="https://code.claude.com/docs/en/mcp">Official Claude Code MCP documentation</a>
        </p>
      </section>

      <section className="docs-section" id="claude-desktop" aria-labelledby="claude-desktop-title">
        <h2 id="claude-desktop-title">Claude Desktop</h2>
        <ol>
          <li>
            In the desktop app, open <strong>Settings → Developer → Edit Config</strong> to edit{' '}
            <code>claude_desktop_config.json</code>. The standard Windows path is{' '}
            <code>{desktopConfigPath}</code>.
          </li>
          <li>
            Add the <code>kafene</code> entry under <code>mcpServers</code>, keeping
            any existing servers. Use the absolute paths printed during setup;
            write each Windows backslash as two backslashes in JSON.
          </li>
          <li>
            Fully quit and reopen Claude Desktop. In chat, open <strong>+ → Connectors</strong> and
            check for Kafene and its tools.
          </li>
        </ol>
        <Snippet label="Claude Desktop JSON configuration">{claudeDesktopConfig}</Snippet>
        <p>
          <a href="https://modelcontextprotocol.io/docs/develop/connect-local-servers">MCP guide to manual Desktop setup</a>
          {' · '}
          <a href="https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop">Claude Desktop help</a>
        </p>
      </section>

      <section className="docs-section" id="first-call" aria-labelledby="first-call-title">
        <p className="docs-kicker eyebrow">03 / Verify</p>
        <h2 id="first-call-title">Make a read-only first call</h2>
        <p>
          With Kafene open, paste this into the assistant. Approve the read if
          the client asks. A page list or an empty result confirms that the
          client can reach the open workspace.
        </p>
        <Snippet label="First-call prompt">{firstPrompt}</Snippet>
      </section>

      <section className="docs-section" id="tools" aria-labelledby="tools-title">
        <p className="docs-kicker eyebrow">04 / Reference</p>
        <h2 id="tools-title">What the tools can do</h2>
        {toolGroups.map(({ title, tools }) => (
          <div className="docs-tool-group" key={title}>
            <h3>{title}</h3>
            <dl>
              {tools.map(([name, description]) => (
                <div className="docs-tool" key={name}>
                  <dt><code>{name}</code></dt>
                  <dd>{description}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </section>

      <section className="docs-section" id="troubleshooting" aria-labelledby="troubleshooting-title">
        <p className="docs-kicker eyebrow">05 / Troubleshooting</p>
        <h2 id="troubleshooting-title">If the connection stalls</h2>
        <dl>
          <dt><strong>Node or the script cannot be found</strong></dt>
          <dd>
            Reopen PowerShell after installing Node and rerun the prerequisites.
            If the script check is false, launch Kafene once under the same Windows
            account as your client and check again. Use the full path to{' '}
            <code>node.exe</code> in the client configuration.
          </dd>
          <dt><strong>Kafene does not appear in the client</strong></dt>
          <dd>
            Check the config file or project scope, quote paths with spaces in
            PowerShell, and double the backslashes in Desktop JSON. Restart
            the client after editing its configuration. In Claude Desktop,
            check the Local MCP servers panel for startup errors and logs.
          </dd>
          <dt><strong>The tools appear, but the first call fails</strong></dt>
          <dd>
            A connection error such as <code>fetch failed</code> can mean the
            Windows app is closed or could not bind to port <code>49327</code>.
            If Kafene reports a port conflict, free that port and relaunch.
            If you see <code>Kafene workspace is not open</code>, open a
            workspace in the desktop app, wait for it to load, and retry.
            A workspace open in a regular browser is separate.
          </dd>
        </dl>
        <p>
          To isolate a launch problem, ask the script directly for its tool list.
          This should print a JSON response with all eight tools even when the
          workspace is closed; use the first-call prompt to test workspace access.
        </p>
        <Snippet label="PowerShell bridge check">{bridgeCheck}</Snippet>
      </section>
    </article>
  );
}

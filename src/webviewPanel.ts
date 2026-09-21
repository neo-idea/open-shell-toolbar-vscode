import * as vscode from 'vscode';
import { ConfigService, DisplayMode, ShellCommandConfig } from './config';
import { CommandExecutor } from './executor';
import { CommandWizard } from './wizard';

/**
 * Rich management panel (WebviewView) in the Secondary Side Bar — the VSCode
 * counterpart of the IntelliJ plugin's Tool Window. Renders command cards
 * with run/edit/duplicate/delete/enable actions, live search, display-mode
 * switching and JSON import/export. All state flows through ConfigService
 * events, so the panel, status bar and palette stay in sync.
 */
export class ShellCommandsPanel implements vscode.WebviewViewProvider {

    public static readonly viewId = 'openShellCommands';

    private view?: vscode.WebviewView;

    constructor(
        private readonly config: ConfigService,
        private readonly executor: CommandExecutor,
        private readonly wizard: CommandWizard,
    ) {
        config.onDidChange(() => this.push());
    }

    resolveWebviewView(view: vscode.WebviewView): void {
        this.view = view;
        view.webview.options = { enableScripts: true };
        view.webview.html = this.html(view.webview);
        view.webview.onDidReceiveMessage(message => void this.handle(message));
        this.push();
    }

    /** Sends the latest commands + display mode to the webview. */
    push(): void {
        void this.view?.webview.postMessage({
            type: 'state',
            commands: this.config.getCommands(),
            mode: this.config.getDisplayMode(),
        });
    }

    private find(id: string): ShellCommandConfig | undefined {
        return this.config.getCommands().find(c => c.id === id);
    }

    private async handle(message: PanelMessage): Promise<void> {
        switch (message.type) {
            case 'add':
                await this.wizard.add();
                break;
            case 'run': {
                const cmd = this.find(message.id);
                if (cmd) {
                    this.executor.execute(cmd);
                }
                break;
            }
            case 'edit': {
                const cmd = this.find(message.id);
                if (cmd) {
                    await this.wizard.edit(cmd);
                }
                break;
            }
            case 'duplicate': {
                const cmd = this.find(message.id);
                if (cmd) {
                    await vscode.commands.executeCommand('openShell.duplicateCommand', cmd);
                }
                break;
            }
            case 'delete': {
                const cmd = this.find(message.id);
                if (cmd) {
                    await vscode.commands.executeCommand('openShell.deleteCommand', cmd);
                }
                break;
            }
            case 'toggle': {
                const cmd = this.find(message.id);
                if (cmd) {
                    await this.config.updateCommand({ ...cmd, enabled: !cmd.enabled });
                }
                break;
            }
            case 'setMode':
                if (message.mode === 'flat' || message.mode === 'popup') {
                    await this.config.setDisplayMode(message.mode as DisplayMode);
                }
                break;
            case 'import':
                await vscode.commands.executeCommand('openShell.importConfig');
                break;
            case 'export':
                await vscode.commands.executeCommand('openShell.exportConfig');
                break;
        }
    }

    // ── HTML ────────────────────────────────────────────────────────────

    private html(webview: vscode.Webview): string {
        const nonce = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
        const csp = [
            "default-src 'none'",
            `style-src ${webview.cspSource} 'unsafe-inline'`,
            `script-src 'nonce-${nonce}'`,
        ].join('; ');

        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<style>
  body {
    padding: 6px 0 16px;
    color: var(--vscode-sideBar-foreground, #ccc);
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size, 13px);
  }
  header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  header h2 { font-size: 13px; font-weight: 600; margin: 0; text-transform: uppercase; letter-spacing: .04em; opacity: .85; }
  select, input[type="text"] {
    width: 100%;
    box-sizing: border-box;
    padding: 4px 6px;
    color: var(--vscode-input-foreground);
    background: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 3px;
    outline: none;
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size, 13px);
  }
  .toolbar { display: flex; gap: 6px; margin: 8px 0 6px; }
  .search { margin-bottom: 8px; }
  button {
    cursor: pointer;
    border: none;
    border-radius: 3px;
    padding: 4px 10px;
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size, 12px);
    color: var(--vscode-button-foreground, #fff);
    background: var(--vscode-button-background, #0e639c);
  }
  button:hover { background: var(--vscode-button-hoverBackground, #1177bb); }
  button.secondary {
    color: var(--vscode-button-secondaryForeground, #ccc);
    background: var(--vscode-button-secondaryBackground, #3a3d41);
  }
  button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground, #45494e); }
  button.small { padding: 2px 8px; font-size: 11px; }
  .grow { flex: 1; }
  .card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    margin-bottom: 6px;
    border-radius: 5px;
    background: var(--vscode-editorWidget-background, rgba(128,128,128,.08));
    border: 1px solid var(--vscode-widget-border, rgba(128,128,128,.2));
    cursor: pointer;
  }
  .card:hover { border-color: var(--vscode-focusBorder, rgba(128,128,128,.5)); }
  .card.disabled { opacity: .5; }
  .icon {
    flex: 0 0 26px; height: 26px;
    display: flex; align-items: center; justify-content: center;
    font-size: 15px;
    border-radius: 4px;
    background: var(--vscode-badge-background, rgba(128,128,128,.25));
  }
  .meta { flex: 1; min-width: 0; }
  .title { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cmd {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 11px; opacity: .75;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .badges { margin-top: 2px; font-size: 10px; opacity: .8; }
  .actions { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; justify-content: flex-end; }
  .switch { display: flex; align-items: center; gap: 4px; font-size: 11px; opacity: .8; cursor: pointer; }
  .empty {
    text-align: center; padding: 40px 10px; opacity: .8;
  }
  .empty .big { font-size: 30px; margin-bottom: 8px; }
  .hint { margin-top: 12px; font-size: 11px; opacity: .6; text-align: center; }
</style>
</head>
<body>
  <header>
    <h2>Shell Commands</h2>
    <select id="mode" style="width:auto" title="Status bar display mode">
      <option value="flat">Flat — button per command</option>
      <option value="popup">Popup — single button</option>
    </select>
  </header>

  <div class="toolbar">
    <button id="add">+ Add Command</button>
    <button id="import" class="secondary grow" title="Import commands from JSON">Import</button>
    <button id="export" class="secondary grow" title="Export commands to JSON">Export</button>
  </div>

  <div class="search"><input id="search" type="text" placeholder="Search commands..."></div>

  <div id="list"></div>

  <div class="hint">Click a card's ▶ to run — it executes in the integrated terminal.</div>

<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  let state = { commands: [], mode: 'flat' };

  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'state') {
      state = e.data;
      render();
    }
  });

  document.getElementById('mode').addEventListener('change', (e) => {
    vscode.postMessage({ type: 'setMode', mode: e.target.value });
  });
  document.getElementById('add').addEventListener('click', () => vscode.postMessage({ type: 'add' }));
  document.getElementById('import').addEventListener('click', () => vscode.postMessage({ type: 'import' }));
  document.getElementById('export').addEventListener('click', () => vscode.postMessage({ type: 'export' }));
  document.getElementById('search').addEventListener('input', render);

  // Event delegation: no inline onclick — ids from imported JSON are
  // attacker-controlled, so they must never be interpolated into handlers.
  // A click on a card runs it; a click on a [data-act] button wins first.
  document.getElementById('list').addEventListener('click', (e) => {
    const action = e.target.closest('[data-act]');
    if (action) {
      vscode.postMessage({ type: action.dataset.act, id: action.dataset.id });
      return;
    }
    const card = e.target.closest('[data-run-id]');
    if (card) {
      vscode.postMessage({ type: 'run', id: card.dataset.runId });
    }
  });

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function iconText(raw) {
    if (!raw) { return '&#9654;'; }
    if (raw.startsWith('$(')) { return '&#9654;'; }
    return escapeHtml(raw);
  }

  function render() {
    const list = document.getElementById('list');
    document.getElementById('mode').value = state.mode;
    const q = document.getElementById('search').value.trim().toLowerCase();

    const commands = state.commands.filter(c =>
      !q || (c.title || '').toLowerCase().includes(q) || (c.command || '').toLowerCase().includes(q));

    if (commands.length === 0) {
      list.innerHTML = \`
        <div class="empty">
          <div class="big">&#9000;</div>
          <div>\${q ? 'No commands match your search.' : 'No shell commands yet.'}</div>
          \${q ? '' : '<div style="margin-top:10px"><button data-act="add">+ Add Command</button></div>'}
        </div>\`;
      return;
    }

    list.innerHTML = commands.map(c => \`
      <div class="card \${c.enabled ? '' : 'disabled'}" data-run-id="\${escapeHtml(c.id)}" title="Click to run">
        <div class="icon" title="\${escapeHtml(c.icon || '')}">\${iconText(c.icon)}</div>
        <div class="meta">
          <div class="title">\${escapeHtml(c.title)}</div>
          <div class="cmd">$ \${escapeHtml(c.command)}</div>
          <div class="badges">\${c.openInTerminal ? '&#9000; terminal' : '&#128172; notification'}\${c.enabled ? '' : ' &middot; disabled'}</div>
        </div>
        <div class="actions">
          <button class="small" data-act="run" data-id="\${escapeHtml(c.id)}" title="Run now">&#9654; Run</button>
          <button class="small secondary" data-act="edit" data-id="\${escapeHtml(c.id)}" title="Edit">&#9998;</button>
          <button class="small secondary" data-act="duplicate" data-id="\${escapeHtml(c.id)}" title="Duplicate">&#10697;</button>
          <button class="small secondary" data-act="toggle" data-id="\${escapeHtml(c.id)}" title="\${c.enabled ? 'Disable' : 'Enable'}">\${c.enabled ? '&#9723;' : '&#9745;'}</button>
          <button class="small secondary" data-act="delete" data-id="\${escapeHtml(c.id)}" title="Delete">&#128465;</button>
        </div>
      </div>\`).join('');
  }

  render();
</script>
</body>
</html>`;
    }
}

type PanelMessage =
    | { type: 'add' }
    | { type: 'run' | 'edit' | 'duplicate' | 'delete' | 'toggle'; id: string }
    | { type: 'setMode'; mode: string }
    | { type: 'import' }
    | { type: 'export' };

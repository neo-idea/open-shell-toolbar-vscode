import * as vscode from 'vscode';
import { ConfigService, DisplayMode, ShellCommandConfig, createDefaultCommand } from './config';
import { CommandExecutor } from './executor';

/**
 * Manager panel (WebviewView) in the Secondary Side Bar. Two views in one
 * webview: the command-card list (run/edit/duplicate/enable/delete, live
 * search, mode switch, import/export) and an add/edit FORM so all fields
 * can be filled on one screen — no chains of input boxes. State flows
 * through ConfigService events, so panel, status bar and palette stay in
 * sync.
 */
export class ShellCommandsPanel implements vscode.WebviewViewProvider {

    public static readonly viewId = 'openShellCommands';

    private view?: vscode.WebviewView;
    private pendingForm?: { id?: string; command?: ShellCommandConfig };

    constructor(
        private readonly config: ConfigService,
        private readonly executor: CommandExecutor,
    ) {
        config.onDidChange(() => this.push());
    }

    resolveWebviewView(view: vscode.WebviewView): void {
        this.view = view;
        view.webview.options = { enableScripts: true };
        view.webview.html = this.html(view.webview);
        view.webview.onDidReceiveMessage(message => void this.handle(message));
        // A retained (hidden) webview never reloads, so 'ready' won't fire
        // again when the view is re-shown — flush on visibility instead.
        view.onDidChangeVisibility(() => {
            if (view.visible) {
                this.flushPendingForm();
            }
        });
        // NOTE: no push() here — messages posted before the webview script
        // loads are silently dropped. The webview announces itself with
        // 'ready' and we (re)send state + any pending form then.
    }

    /** Delivers a stashed form request; cleared by the webview's 'formShown' ack. */
    private flushPendingForm(): void {
        if (!this.pendingForm) {
            return;
        }
        void this.view?.webview.postMessage({ type: 'beginForm', ...this.pendingForm });
    }

    /** Opens the add/edit form; focuses the panel first if it is not open yet. */
    requestForm(command?: ShellCommandConfig): void {
        // Stash always: if the webview script is not loaded yet, a direct
        // postMessage would be lost — 'ready' flushes the stash instead.
        this.pendingForm = command ? { id: command.id, command } : {};
        if (this.view?.visible) {
            void this.view.webview.postMessage({ type: 'beginForm', command });
        } else {
            void vscode.commands.executeCommand('openShellCommands.focus');
        }
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
            case 'ready':
                // Webview script is up — now state (and a pending form, if
                // any) will actually be received.
                this.push();
                this.flushPendingForm();
                break;
            case 'formShown':
                this.pendingForm = undefined;
                break;
            case 'add':
                this.requestForm();
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
                    this.requestForm(cmd);
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
            case 'save': {
                await this.save(message.id, message.fields);
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

    private async save(id: string | undefined, fields: FormFields): Promise<void> {
        // The webview validates too, but never trust remote input.
        if (!fields.title.trim() || !fields.command.trim()) {
            void this.view?.webview.postMessage({
                type: 'formError',
                message: 'Title and Command are required.',
            });
            return;
        }
        const config = createDefaultCommand({
            title: fields.title.trim(),
            command: fields.command.trim(),
            workingDir: fields.workingDir.trim() || undefined,
            icon: fields.icon.trim() || undefined,
            openInTerminal: fields.openInTerminal,
            enabled: fields.enabled,
        });
        if (id && this.find(id)) {
            config.id = id;
            await this.config.updateCommand(config);
        } else {
            config.id = this.config.newId();
            await this.config.addCommand(config);
        }
        // onDidChange → push() → webview leaves the form.
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
  select, input[type="text"], textarea {
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
  textarea {
    min-height: 64px; resize: vertical;
    font-family: var(--vscode-editor-font-family, monospace);
  }
  input.invalid, textarea.invalid { border-color: var(--vscode-inputValidation-errorBorder, #be1100); }
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
  .empty { text-align: center; padding: 40px 10px; opacity: .8; }
  .empty .big { font-size: 30px; margin-bottom: 8px; }
  .hint { margin-top: 12px; font-size: 11px; opacity: .6; text-align: center; }

  /* ── form view ── */
  .field { margin-bottom: 10px; }
  .field label { display: block; font-size: 11px; opacity: .85; margin-bottom: 3px; }
  .field .note { font-size: 10px; opacity: .6; margin-top: 3px; }
  .icon-row { display: flex; gap: 6px; align-items: center; }
  .icon-row input { flex: 1; }
  .icon-preview {
    flex: 0 0 26px; height: 26px;
    display: flex; align-items: center; justify-content: center;
    font-size: 15px;
    border-radius: 4px;
    background: var(--vscode-badge-background, rgba(128,128,128,.25));
  }
  .checks { display: flex; gap: 16px; margin: 12px 0; }
  .checks label { display: flex; gap: 5px; align-items: center; cursor: pointer; }
  .form-actions { display: flex; gap: 6px; margin-top: 14px; }
  .form-error {
    margin-top: 8px; padding: 6px 8px; border-radius: 3px; font-size: 11px;
    background: var(--vscode-inputValidation-errorBackground, rgba(190,17,0,.15));
    border: 1px solid var(--vscode-inputValidation-errorBorder, #be1100);
  }
</style>
</head>
<body>

  <div id="listView">
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

    <div class="hint">Click a card to run — it executes in the integrated terminal.</div>
  </div>

  <div id="formView" style="display:none">
    <header><h2 id="formTitle">Add Command</h2></header>

    <div class="field">
      <label for="f-title">Title</label>
      <input id="f-title" type="text" placeholder="Dev Server">
    </div>

    <div class="field">
      <label for="f-command">Command</label>
      <textarea id="f-command" placeholder="pnpm dev"></textarea>
      <div class="note">Multi-line is fine. ⌘/Ctrl+Enter saves.</div>
    </div>

    <div class="field">
      <label for="f-dir">Working directory <span style="opacity:.6">(optional, defaults to workspace)</span></label>
      <input id="f-dir" type="text" placeholder="\${workspaceFolder}">
    </div>

    <div class="field">
      <label for="f-icon">Icon <span style="opacity:.6">(emoji 🚀 or codicon $(terminal))</span></label>
      <div class="icon-row">
        <input id="f-icon" type="text" placeholder="🚀">
        <div class="icon-preview" id="iconPreview">▶</div>
      </div>
    </div>

    <div class="checks">
      <label><input id="f-terminal" type="checkbox" checked> Run in terminal</label>
      <label><input id="f-enabled" type="checkbox" checked> Enabled</label>
    </div>

    <div class="form-actions">
      <button id="save">Save</button>
      <button id="cancel" class="secondary">Cancel</button>
    </div>

    <div id="formError" class="form-error" style="display:none"></div>
  </div>

<script nonce="\${nonce}">
  const vscode = acquireVsCodeApi();
  vscode.postMessage({ type: 'ready' });
  let state = { commands: [], mode: 'flat' };
  let view = 'list';          // 'list' | 'form'
  let editingId = null;       // null = adding
  let pendingSave = false;

  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d) { return; }
    if (d.type === 'beginForm') {
      vscode.postMessage({ type: 'formShown' });
      editingId = (d.command && d.command.id) || null;
      document.getElementById('formTitle').textContent = editingId ? 'Edit Command' : 'Add Command';
      document.getElementById('f-title').value = d.command ? (d.command.title || '') : '';
      document.getElementById('f-command').value = d.command ? (d.command.command || '') : '';
      document.getElementById('f-dir').value = d.command ? (d.command.workingDir || '') : '';
      document.getElementById('f-icon').value = d.command ? (d.command.icon || '') : '';
      document.getElementById('f-terminal').checked = d.command ? !!d.command.openInTerminal : true;
      document.getElementById('f-enabled').checked = d.command ? !!d.command.enabled : true;
      showFormError('');
      view = 'form';
      render();
      document.getElementById('f-title').focus();
    } else if (d.type === 'formError') {
      pendingSave = false;
      showFormError(d.message);
    } else if (d.type === 'state') {
      state = d;
      if (pendingSave) { pendingSave = false; view = 'list'; }
      render();
    }
  });

  function render() {
    document.getElementById('listView').style.display = view === 'list' ? '' : 'none';
    document.getElementById('formView').style.display = view === 'form' ? '' : 'none';
    if (view === 'list') { renderList(); }
  }

  // ── form ──
  function showFormError(text) {
    const el = document.getElementById('formError');
    el.textContent = text;
    el.style.display = text ? '' : 'none';
  }
  function mark(input, bad) { input.classList.toggle('invalid', bad); return bad; }
  function submitForm() {
    const title = document.getElementById('f-title');
    const command = document.getElementById('f-command');
    let bad = false;
    bad = mark(title, !title.value.trim()) || bad;
    bad = mark(command, !command.value.trim()) || bad;
    if (bad) { showFormError('Title and Command are required.'); return; }
    vscode.postMessage({
      type: 'save',
      id: editingId || undefined,
      fields: {
        title: title.value,
        command: command.value,
        workingDir: document.getElementById('f-dir').value,
        icon: document.getElementById('f-icon').value,
        openInTerminal: document.getElementById('f-terminal').checked,
        enabled: document.getElementById('f-enabled').checked,
      },
    });
    pendingSave = true;
    showFormError('');
  }
  document.getElementById('save').addEventListener('click', submitForm);
  document.getElementById('cancel').addEventListener('click', () => { view = 'list'; render(); });
  document.getElementById('f-title').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); document.getElementById('f-command').focus(); }
  });
  document.getElementById('f-command').addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submitForm(); }
  });
  document.getElementById('f-icon').addEventListener('input', (e) => {
    const v = e.target.value.trim();
    document.getElementById('iconPreview').textContent = (!v || v.startsWith('$(')) ? '▶' : v;
  });

  // ── list ──
  document.getElementById('mode').addEventListener('change', (e) => {
    vscode.postMessage({ type: 'setMode', mode: e.target.value });
  });
  document.getElementById('add').addEventListener('click', () => vscode.postMessage({ type: 'add' }));
  document.getElementById('import').addEventListener('click', () => vscode.postMessage({ type: 'import' }));
  document.getElementById('export').addEventListener('click', () => vscode.postMessage({ type: 'export' }));
  document.getElementById('search').addEventListener('input', () => { if (view === 'list') { renderList(); } });

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
    if (!raw || raw.startsWith('$(')) { return '&#9654;'; }
    return escapeHtml(raw);
  }

  function renderList() {
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

interface FormFields {
    title: string;
    command: string;
    workingDir: string;
    icon: string;
    openInTerminal: boolean;
    enabled: boolean;
}

type PanelMessage =
    | { type: 'ready' }
    | { type: 'formShown' }
    | { type: 'add' }
    | { type: 'run' | 'edit' | 'duplicate' | 'delete' | 'toggle'; id: string }
    | { type: 'save'; id?: string; fields: FormFields }
    | { type: 'setMode'; mode: string }
    | { type: 'import' }
    | { type: 'export' };

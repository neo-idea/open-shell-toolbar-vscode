import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConfigService, DisplayMode, ShellCommandConfig, createDefaultCommand } from './config';
import { CommandExecutor } from './executor';
import { StatusBarManager } from './statusBar';
import { ShellCommandsPanel } from './webviewPanel';

const INTRO_KEY = 'openShellToolbar.introShown';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    const config = new ConfigService(context);
    _test.config = config;
    const executor = new CommandExecutor();
    const statusBar = new StatusBarManager(config);
    const panel = new ShellCommandsPanel(config, executor);

    // Drive the editor-toolbar button's visibility ("when" context).
    const syncHasCommands = () =>
        void vscode.commands.executeCommand(
            'setContext', 'openShellToolbar.hasCommands', config.getCommands().length > 0);
    config.onDidChange(syncHasCommands);
    syncHasCommands();

    const openManager = vscode.commands.registerCommand('openShell.openManager', () =>
        vscode.commands.executeCommand('openShellCommands.focus'));

    const runCommand = vscode.commands.registerCommand('openShell.runCommand', (cmd: ShellCommandConfig) => {
        if (cmd) {
            executor.execute(cmd);
        }
    });

    const pickAndRun = vscode.commands.registerCommand('openShell.pickAndRun', async () => {
        const commands = config.getEnabledCommands();
        // The launcher menu must be self-sufficient: adding a command can
        // never depend on the (possibly hidden) panel being in a good state.
        type Pick = vscode.QuickPickItem & { config?: ShellCommandConfig; add?: boolean; manage?: boolean };
        const picks: Pick[] = [
            { label: '$(add) Add New Command…', add: true, alwaysShow: true },
            ...commands.map(c => ({
                label: `${c.icon && c.icon.trim() ? `${c.icon.trim()} ` : '$(play) '}${c.title}`,
                description: c.command.length > 60 ? `${c.command.slice(0, 57)}...` : c.command,
                config: c,
            })),
            { label: '$(gear) Manage Commands…', manage: true, alwaysShow: true },
        ];
        const picked = await vscode.window.showQuickPick(picks, {
            placeHolder: commands.length > 0 ? 'Run a shell command...' : 'Add your first shell command…',
        });
        if (!picked) {
            return;
        }
        if (picked.add) {
            panel.requestForm();
        } else if (picked.manage) {
            void vscode.commands.executeCommand('openShellCommands.focus');
        } else if (picked.config) {
            executor.execute(picked.config);
        }
    });

    const addCommand = vscode.commands.registerCommand('openShell.addCommand', () => panel.requestForm());

    const editCommand = vscode.commands.registerCommand('openShell.editCommand', (cmd: ShellCommandConfig) => {
        if (cmd) {
            void panel.requestForm(cmd);
        }
    });

    const duplicateCommand = vscode.commands.registerCommand('openShell.duplicateCommand', async (cmd: ShellCommandConfig) => {
        if (!cmd) {
            return;
        }
        const copy = createDefaultCommand({ ...cmd, title: `${cmd.title} (copy)` });
        copy.id = config.newId();
        await config.addCommand(copy);
    });

    const deleteCommand = vscode.commands.registerCommand('openShell.deleteCommand', async (cmd: ShellCommandConfig) => {
        if (!cmd) {
            return;
        }
        const answer = await vscode.window.showWarningMessage(
            `Delete "${cmd.title}"?`, { modal: true }, 'Delete');
        if (answer === 'Delete') {
            await config.deleteCommand(cmd.id);
        }
    });

    const toggleEnabled = vscode.commands.registerCommand('openShell.toggleEnabled', async (cmd: ShellCommandConfig) => {
        if (cmd) {
            const updated = { ...cmd, enabled: !cmd.enabled };
            await config.updateCommand(updated);
        }
    });

    const setDisplayMode = vscode.commands.registerCommand('openShell.setDisplayMode', async () => {
        const picked = await vscode.window.showQuickPick(
            [
                { label: 'Flat — one status bar button per command', value: 'flat' as DisplayMode },
                { label: 'Popup — a single button with a quick-pick menu', value: 'popup' as DisplayMode },
            ],
            { placeHolder: `Current: ${config.getDisplayMode()}` },
        );
        if (picked) {
            await config.setDisplayMode(picked.value);
        }
    });

    const importConfig = vscode.commands.registerCommand('openShell.importConfig', async () => {
        const uris = await vscode.window.showOpenDialog({
            canSelectMany: false,
            filters: { 'JSON': ['json'] },
            openLabel: 'Import',
        });
        if (!uris || uris.length === 0) {
            return;
        }
        try {
            const raw = fs.readFileSync(uris[0].fsPath, 'utf8');
            const parsed = JSON.parse(raw);
            const incoming: ShellCommandConfig[] = Array.isArray(parsed) ? parsed : parsed.commands;
            if (!Array.isArray(incoming)) {
                throw new Error('Expected a JSON array of commands or a {"commands": [...]} object.');
            }
            const normalized = incoming.map((c: Partial<ShellCommandConfig>, i: number) => {
                const cmd = createDefaultCommand(c);
                // ids end up in webview attributes — keep them to a safe charset
                const rawId = typeof c.id === 'string' ? c.id.replace(/[^A-Za-z0-9_-]/g, '') : '';
                cmd.id = rawId.length > 0 ? rawId : config.newId();
                cmd.title = c.title ?? `Command ${i + 1}`;
                cmd.command = c.command ?? '';
                return cmd;
            });
            await config.saveCommands([...config.getCommands(), ...normalized]);
            vscode.window.showInformationMessage(`Open Shell: imported ${normalized.length} command(s).`);
        } catch (err) {
            vscode.window.showErrorMessage(`Open Shell: import failed — ${String(err)}`);
        }
    });

    const exportConfig = vscode.commands.registerCommand('openShell.exportConfig', async () => {
        const commands = config.getCommands();
        if (commands.length === 0) {
            vscode.window.showInformationMessage('Open Shell: nothing to export.');
            return;
        }
        const defaultPath = path.join(
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? os.homedir(),
            'open-shell-commands.json');
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(defaultPath),
            filters: { 'JSON': ['json'] },
        });
        if (!uri) {
            return;
        }
        fs.writeFileSync(uri.fsPath, JSON.stringify({ commands }, null, 2), 'utf8');
        vscode.window.showInformationMessage(`Open Shell: exported ${commands.length} command(s).`);
    });

    const panelRegistration = vscode.window.registerWebviewViewProvider(
        ShellCommandsPanel.viewId, panel, { webviewOptions: { retainContextWhenHidden: true } });

    context.subscriptions.push(
        config, statusBar, panelRegistration,
        runCommand, pickAndRun, addCommand, editCommand, duplicateCommand,
        deleteCommand, toggleEnabled, setDisplayMode, openManager,
        importConfig, exportConfig,
    );

    statusBar.render();

    // First-run guidance: the Secondary Side Bar icon can be hidden, so point
    // users at the always-visible status-bar gear button first. Fire-and-
    // forget — activation must never wait on UI (it deadlocks headless hosts).
    if (!context.globalState.get<boolean>(INTRO_KEY)) {
        void context.globalState.update(INTRO_KEY, true);
        void vscode.window
            .showInformationMessage(
                'Open Shell Toolbar installed. Maintain commands in the manager panel (⚙ bottom-right) and run them from the ▶ button at the top-right of the editor.',
                'Open Manager',
                'Add Command',
                'Show Guide')
            .then(pick => {
                if (pick === 'Open Manager') {
                    void vscode.commands.executeCommand('openShellCommands.focus');
                } else if (pick === 'Add Command') {
                    void vscode.commands.executeCommand('openShell.addCommand');
                } else if (pick === 'Show Guide') {
                    void vscode.commands.executeCommand(
                        'workbench.action.openWalkthrough',
                        'neo-idea.open-shell-toolbar#openShell.gettingStarted');
                }
            });
    }
}

export function deactivate(): void {
    // nothing — disposables live in context.subscriptions
}

/** Live instances from the last activate() call — integration-test access only. */
export const _test = {
    config: undefined as ConfigService | undefined,
};

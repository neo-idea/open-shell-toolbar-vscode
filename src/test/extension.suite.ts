import * as assert from 'assert';
import * as vscode from 'vscode';
import { ShellCommandConfig } from '../config';

/**
 * End-to-end checks inside a real VS Code extension host (no mocha globals —
 * recent hosts don't inject them). These encode the product promise:
 * maintain commands in the panel → run them from the always-visible
 * top-right launcher / status bar / terminal.
 */

async function activateExt(): Promise<vscode.Extension<void>> {
    const ext = vscode.extensions.getExtension('neo-idea.open-shell-toolbar');
    assert.ok(ext, 'extension is not present in the host');
    await ext.activate();
    assert.strictEqual(ext.isActive, true, 'extension failed to activate');
    return ext as vscode.Extension<void>;
}

async function topRightLauncherIsAlwaysVisible(ext: vscode.Extension<void>): Promise<void> {
    const menus = ext.packageJSON.contributes.menus as Record<string, Array<Record<string, string>>>;
    const entry = menus['editor/title']?.find(m => m.command === 'openShell.pickAndRun');
    assert.ok(entry, 'editor/title menu entry for the launcher is missing');
    assert.strictEqual(entry.group, 'navigation', 'launcher must sit in the top-right navigation group');
    assert.strictEqual(entry.when, undefined, 'launcher must not be gated — it has to appear top-right at all times');
}

async function commandsPersistAndPropagate(): Promise<void> {
    const { _test } = await import('../extension');
    const config = _test.config;
    assert.ok(config, 'ConfigService was not created during activation');

    const cmd: ShellCommandConfig = {
        id: config!.newId(),
        title: 'Suite Hi',
        command: 'open .',
        openInTerminal: true,
        enabled: true,
    };
    await config!.addCommand(cmd);
    assert.ok(config!.getCommands().some(c => c.id === cmd.id), 'command not persisted');

    await config!.updateCommand({ ...cmd, enabled: false });
    assert.strictEqual(config!.getEnabledCommands().some(c => c.id === cmd.id), false,
        'disabling did not propagate');

    await config!.deleteCommand(cmd.id);
    assert.strictEqual(config!.getCommands().some(c => c.id === cmd.id), false,
        'delete did not propagate');
}

async function runCommandExecutesInTerminal(): Promise<void> {
    const before = vscode.window.terminals.length;
    await vscode.commands.executeCommand('openShell.runCommand', {
        id: 'suite_run',
        title: 'Suite Run',
        command: 'echo open-shell-suite-ok',
        openInTerminal: true,
        enabled: true,
    } as ShellCommandConfig);
    assert.ok(vscode.window.terminals.length > before,
        'no terminal was created for the command');
}

export async function run(): Promise<void> {
    const ext = await activateExt();
    console.log('✔ activates without error');

    await topRightLauncherIsAlwaysVisible(ext);
    console.log('✔ top-right launcher button is always visible (no when-gate)');

    await commandsPersistAndPropagate();
    console.log('✔ maintained commands persist and propagate through ConfigService');

    await runCommandExecutesInTerminal();
    console.log('✔ runCommand executes in a real integrated terminal');
    console.log('ALL INTEGRATION TESTS PASSED');
}

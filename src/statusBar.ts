import * as vscode from 'vscode';
import { ConfigService } from './config';

/**
 * Renders commands on the status bar:
 *  - flat  (default): one status bar button per enabled command
 *  - popup: one button that opens a QuickPick with all commands
 * Re-renders live on every config change.
 */
export class StatusBarManager implements vscode.Disposable {
    private items: vscode.StatusBarItem[] = [];

    constructor(private readonly config: ConfigService) {
        config.onDidChange(() => this.render());
    }

    render(): void {
        for (const item of this.items) {
            item.dispose();
        }
        this.items = [];

        const commands = this.config.getEnabledCommands();
        if (this.config.getDisplayMode() === 'popup' || commands.length === 0) {
            const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1000);
            item.name = 'Open Shell Toolbar';
            if (commands.length === 0) {
                item.text = '$(terminal) Shell +';
                item.tooltip = 'Open Shell Toolbar — no commands yet. Click to add your first one.';
                item.command = 'openShell.addCommand';
            } else {
                item.text = `$(terminal) Commands (${commands.length})`;
                item.tooltip = 'Open Shell Toolbar — pick a command to run';
                item.command = 'openShell.pickAndRun';
            }
            item.show();
            this.items.push(item);
            return;
        }

        commands.forEach((cmd, index) => {
            const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1000 - index);
            item.name = `Open Shell: ${cmd.title}`;
            item.text = `${iconOr(cmd.icon, '$(play)')} ${cmd.title}`;
            // 4-backtick fence so commands containing ` render correctly.
            item.tooltip = new vscode.MarkdownString(
                "````\n" +
                (cmd.workingDir ? `# in ${cmd.workingDir}\n` : '') +
                cmd.command +
                "\n````");
            item.command = {
                title: `Run ${cmd.title}`,
                command: 'openShell.runCommand',
                arguments: [cmd],
            };
            item.show();
            this.items.push(item);
        });
    }

    dispose(): void {
        for (const item of this.items) {
            item.dispose();
        }
        this.items = [];
    }
}

function iconOr(icon: string | undefined, fallback: string): string {
    return icon && icon.trim().length > 0 ? icon.trim() : fallback;
}


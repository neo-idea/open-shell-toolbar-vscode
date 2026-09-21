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
            item.text = `$(terminal) ${commands.length === 0 ? 'Shell' : 'Commands'}`;
            item.tooltip = 'Open Shell Toolbar — pick a command to run';
            item.command = commands.length === 0 ? 'openShell.addCommand' : 'openShell.pickAndRun';
            item.show();
            this.items.push(item);
            return;
        }

        commands.forEach((cmd, index) => {
            const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1000 - index);
            item.name = `Open Shell: ${cmd.title}`;
            item.text = `${iconOr(cmd.icon, '$(play)')} ${cmd.title}`;
            item.tooltip = new vscode.MarkdownString(
                `\`\`\`bash\n${escapeMd(cmd.command)}\n\`\`\``);
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

function escapeMd(text: string): string {
    return text.replace(/`/g, '\\`');
}

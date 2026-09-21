import * as vscode from 'vscode';
import { ConfigService, ShellCommandConfig } from './config';

/**
 * Sidebar tree (Explorer > Shell Commands): click to run, right-click for
 * edit / duplicate / enable / delete. Refreshes live on config changes.
 */
export class ShellCommandsTreeProvider implements vscode.TreeDataProvider<ShellCommandConfig> {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<ShellCommandConfig | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private readonly config: ConfigService) {
        config.onDidChange(() => this._onDidChangeTreeData.fire());
    }

    getTreeItem(element: ShellCommandConfig): vscode.TreeItem {
        const item = new vscode.TreeItem(element.title, vscode.TreeItemCollapsibleState.None);
        const icon = element.icon && element.icon.trim().length > 0 ? `${element.icon.trim()} ` : '';
        item.label = `${icon}${element.title}${element.enabled ? '' : ' (disabled)'}`;
        item.tooltip = new vscode.MarkdownString(
            `\`\`\`bash\n${element.command.replace(/`/g, '\\`')}\n\`\`\``);
        item.description = element.command.length > 48
            ? `${element.command.slice(0, 45)}...`
            : element.command;
        item.contextValue = 'shellCommand';
        item.command = {
            title: `Run ${element.title}`,
            command: 'openShell.runCommand',
            arguments: [element],
        };
        return item;
    }

    getChildren(): ShellCommandConfig[] {
        return this.config.getCommands();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }
}

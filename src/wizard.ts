import * as vscode from 'vscode';
import { ConfigService, ShellCommandConfig, createDefaultCommand } from './config';

/**
 * Add / edit flows using native input boxes:
 * Title → Command → Working Directory → Icon → Terminal? → Enabled?
 */
export class CommandWizard {
    constructor(private readonly config: ConfigService) { }

    async add(): Promise<void> {
        const created = await this.prompt(undefined);
        if (created) {
            created.id = this.config.newId();
            await this.config.addCommand(created);
            vscode.window.showInformationMessage(`Open Shell: added "${created.title}".`);
        }
    }

    async edit(existing: ShellCommandConfig): Promise<void> {
        const updated = await this.prompt(existing);
        if (updated) {
            await this.config.updateCommand(updated);
            vscode.window.showInformationMessage(`Open Shell: updated "${updated.title}".`);
        }
    }

    private async prompt(initial: ShellCommandConfig | undefined): Promise<ShellCommandConfig | undefined> {
        const title = await vscode.window.showInputBox({
            prompt: 'Command title (shown on the button)',
            value: initial?.title,
            validateInput: v => (v.trim().length === 0 ? 'Title is required' : undefined),
        });
        if (title === undefined) {
            return undefined;
        }

        const command = await vscode.window.showInputBox({
            prompt: 'Shell command to run (supports ${workspaceFolder}, ${userHome}, ${env:NAME})',
            value: initial?.command,
            validateInput: v => (v.trim().length === 0 ? 'Command is required' : undefined),
        });
        if (command === undefined) {
            return undefined;
        }

        const workingDir = await vscode.window.showInputBox({
            prompt: 'Working directory (empty = workspace folder)',
            value: initial?.workingDir,
            placeHolder: '${workspaceFolder}',
        });

        const icon = await vscode.window.showInputBox({
            prompt: 'Icon: an emoji (🚀) or a codicon id like $(play) — empty for default',
            value: initial?.icon,
        });

        const openInTerminal = await vscode.window.showQuickPick(
            [
                { label: 'Yes', value: true },
                { label: 'No', value: false },
            ],
            {
                placeHolder: 'Run in the integrated terminal? (recommended)',
            },
        );
        if (openInTerminal === undefined) {
            return undefined;
        }

        const enabled = await vscode.window.showQuickPick(
            [
                { label: 'Enabled', value: true },
                { label: 'Disabled', value: false },
            ],
            { placeHolder: 'Enable this command now?' },
        );
        if (enabled === undefined) {
            return undefined;
        }

        const result = createDefaultCommand({
            id: initial?.id,
            title: title.trim(),
            command: command.trim(),
            workingDir: workingDir?.trim() || undefined,
            icon: icon?.trim() || undefined,
        });
        result.openInTerminal = openInTerminal.value;
        result.enabled = enabled.value;
        return result;
    }
}

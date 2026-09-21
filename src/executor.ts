import * as vscode from 'vscode';
import * as os from 'os';
import { exec } from 'child_process';
import { ShellCommandConfig } from './config';
import { substituteVariables } from './variables';

/** Runs pinned commands — in a reused integrated terminal, or in the background with a notification. */
export class CommandExecutor {
    substitute(text: string): string {
        const folder = vscode.workspace.workspaceFolders?.[0];
        return substituteVariables(text, {
            workspaceFolder: folder?.uri.fsPath,
            workspaceFolderBasename: folder?.name,
            userHome: os.homedir(),
            env: process.env,
        });
    }

    execute(config: ShellCommandConfig): void {
        if (config.openInTerminal) {
            this.executeInTerminal(config);
        } else {
            this.executeInBackground(config);
        }
    }

    /** Terminal mode: one reused tab per command, cwd fixed at creation. */
    private executeInTerminal(config: ShellCommandConfig): void {
        const name = `Shell: ${config.title}`;
        const cwd = config.workingDir ? this.substitute(config.workingDir) : undefined;
        let terminal = vscode.window.terminals.find(t => t.name === name);
        if (!terminal) {
            terminal = vscode.window.createTerminal({ name, cwd: cwd || undefined });
        }
        terminal.show();
        terminal.sendText(this.substitute(config.command), true);
    }

    /** Background mode: child_process + completion notification. */
    private executeInBackground(config: ShellCommandConfig): void {
        const cwd = config.workingDir ? this.substitute(config.workingDir) : undefined;
        const command = this.substitute(config.command);
        exec(command, { cwd: cwd || undefined }, (error, stdout, stderr) => {
            if (error) {
                vscode.window.showErrorMessage(
                    `Open Shell "${config.title}" failed: ${truncate(error.message)}`);
                return;
            }
            const output = truncate((stderr || stdout).trim());
            vscode.window.showInformationMessage(
                `Open Shell "${config.title}" done${output ? `: ${output}` : ''}`);
        });
    }
}

function truncate(text: string, max = 200): string {
    return text.length > max ? `${text.slice(0, max)}...` : text;
}

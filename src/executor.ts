import * as vscode from 'vscode';
import * as os from 'os';
import { ShellCommandConfig } from './config';
import { substituteVariables } from './variables';

/** Runs a pinned command in the integrated terminal (one reused tab per command). */
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
        const name = `Shell: ${config.title}`;
        const cwd = config.workingDir ? this.substitute(config.workingDir) : undefined;
        let terminal = vscode.window.terminals.find(t => t.name === name);
        if (!terminal) {
            terminal = vscode.window.createTerminal({ name, cwd: cwd || undefined });
        }
        terminal.show();
        terminal.sendText(this.substitute(config.command), true);
    }
}

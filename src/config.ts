import * as vscode from 'vscode';

/** A pinned shell command. */
export interface ShellCommandConfig {
    id: string;
    title: string;
    command: string;
    workingDir?: string;
    /** Emoji or codicon id (`$(play)`) for the status bar / tree label. */
    icon?: string;
    openInTerminal: boolean;
    enabled: boolean;
}

/** How commands render on the status bar. */
export type DisplayMode = 'flat' | 'popup';

const COMMANDS_KEY = 'openShellToolbar.commands';
const MODE_KEY = 'openShellToolbar.displayMode';

/**
 * Global, persistent storage for commands + display mode, with a change
 * event so the status bar and tree refresh live (mirrors the IntelliJ
 * plugin's CONFIG_CHANGED topic).
 */
export class ConfigService {
    private readonly _onDidChange = new vscode.EventEmitter<void>();
    readonly onDidChange: vscode.Event<void> = this._onDidChange.event;

    constructor(private readonly context: vscode.ExtensionContext) { }

    getCommands(): ShellCommandConfig[] {
        return this.context.globalState.get<ShellCommandConfig[]>(COMMANDS_KEY, []);
    }

    getEnabledCommands(): ShellCommandConfig[] {
        return this.getCommands().filter(c => c.enabled);
    }

    getDisplayMode(): DisplayMode {
        return this.context.globalState.get<DisplayMode>(MODE_KEY, 'flat');
    }

    async setDisplayMode(mode: DisplayMode): Promise<void> {
        if (mode !== this.getDisplayMode()) {
            await this.context.globalState.update(MODE_KEY, mode);
            this._onDidChange.fire();
        }
    }

    async saveCommands(commands: ShellCommandConfig[]): Promise<void> {
        await this.context.globalState.update(COMMANDS_KEY, commands);
        this._onDidChange.fire();
    }

    async addCommand(config: ShellCommandConfig): Promise<void> {
        await this.saveCommands([...this.getCommands(), config]);
    }

    async updateCommand(config: ShellCommandConfig): Promise<void> {
        await this.saveCommands(this.getCommands().map(c => (c.id === config.id ? config : c)));
    }

    async deleteCommand(id: string): Promise<void> {
        await this.saveCommands(this.getCommands().filter(c => c.id !== id));
    }

    newId(): string {
        return `cmd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    }

    dispose(): void {
        this._onDidChange.dispose();
    }
}

/** Creates a config with sensible defaults (terminal-first, like the plugin). */
export function createDefaultCommand(partial: Partial<ShellCommandConfig> = {}): ShellCommandConfig {
    return {
        id: partial.id ?? '',
        title: partial.title ?? '',
        command: partial.command ?? '',
        workingDir: partial.workingDir,
        icon: partial.icon,
        openInTerminal: partial.openInTerminal ?? true,
        enabled: partial.enabled ?? true,
    };
}

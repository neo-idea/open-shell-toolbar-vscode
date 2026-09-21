/**
 * Pure variable substitution — shared with tests. Supported:
 *   ${workspaceFolder}  {{rootPath}}  {{workspaceFolder}}
 *   ${workspaceFolderBasename}  ${userHome}  $HOME  ${env:NAME}
 */
export interface SubstituteContext {
    workspaceFolder?: string;
    workspaceFolderBasename?: string;
    userHome: string;
    env: Record<string, string | undefined>;
}

export function substituteVariables(text: string, ctx: SubstituteContext): string {
    const wf = ctx.workspaceFolder ?? '';
    return text
        .replace(/\$\{workspaceFolder\}/g, wf)
        .replace(/\{\{rootPath\}\}/g, wf)
        .replace(/\{\{workspaceFolder\}\}/g, wf)
        .replace(/\$\{workspaceFolderBasename\}/g, ctx.workspaceFolderBasename ?? '')
        .replace(/\$\{userHome\}/g, ctx.userHome)
        .replace(/\$HOME\b/g, ctx.userHome)
        .replace(/\$\{env:([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, name: string) => ctx.env[name] ?? '');
}

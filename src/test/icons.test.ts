import * as fs from 'fs';
import * as path from 'path';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';

/**
 * Codicon ids actually shipped by VS Code (validated against the
 * codicon.css inside the app bundle). An unknown id — like the former
 * `$(terminal-play)` — silently renders as an invisible/transparent
 * glyph, which once left the top-right launcher looking empty.
 * When you introduce a new `$(id)` icon: verify it exists in
 *   /Applications/Visual Studio Code.app/.../media/codicon.css
 * (or https://microsoft.github.io/vscode-codicons), then add it here.
 */
const VERIFIED_CODICONS = new Set([
    'add', 'copy', 'edit', 'eye', 'gear', 'play', 'run-all', 'terminal', 'trash',
]);

function repoFile(...segments: string[]): string {
    return path.join(__dirname, '..', '..', ...segments);
}

/** Every `$(id)` token used in a source file. */
function codiconIds(source: string): Set<string> {
    return new Set([...source.matchAll(/\$\(([^)$\s]+)\)/g)].map(m => m[1]));
}

test('package.json icon ids are all valid codicons', () => {
    const manifest = fs.readFileSync(repoFile('package.json'), 'utf8');
    const ids = codiconIds(manifest);
    assert.ok(ids.size > 0, 'no codicon tokens found — manifest changed shape?');
    const bad = [...ids].filter(id => !VERIFIED_CODICONS.has(id));
    assert.deepStrictEqual(bad, [], `invalid codicon id(s) render as invisible buttons: ${bad.join(', ')}`);
});

test('statusBar / extension icon ids are all valid codicons', () => {
    const files = ['src/statusBar.ts', 'src/extension.ts'];
    const bad: string[] = [];
    for (const file of files) {
        for (const id of codiconIds(fs.readFileSync(repoFile(file), 'utf8'))) {
            if (!VERIFIED_CODICONS.has(id)) {
                bad.push(`${file}: ${id}`);
            }
        }
    }
    assert.deepStrictEqual(bad, [], `invalid codicon id(s): ${bad.join(', ')}`);
});

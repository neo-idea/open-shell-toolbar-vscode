import * as path from 'path';
import { runTests } from '@vscode/test-electron';

/**
 * Launches a real (downloaded) VS Code instance with this repo loaded as an
 * extension and runs out/test/extension.suite.js inside it. Used by
 * `npm run test:integration`.
 */
async function main(): Promise<void> {
    try {
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');
        const extensionTestsPath = path.resolve(__dirname, './extension.suite');
        await runTests({ extensionDevelopmentPath, extensionTestsPath });
    } catch (err) {
        console.error('Failed to run VS Code integration tests:', err);
        process.exit(1);
    }
}

void main();

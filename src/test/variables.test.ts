import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { substituteVariables } from '../variables';

const ctx = {
    workspaceFolder: '/Users/dev/project',
    workspaceFolderBasename: 'project',
    userHome: '/Users/dev',
    env: { HOME: '/Users/dev', API_KEY: 'secret' },
};

test('substitutes workspace folder tokens', () => {
    assert.equal(substituteVariables('cd ${workspaceFolder} && npm test', ctx),
        'cd /Users/dev/project && npm test');
    assert.equal(substituteVariables('cd {{workspaceFolder}} || cd {{rootPath}}', ctx),
        'cd /Users/dev/project || cd /Users/dev/project');
});

test('substitutes basename, home and env', () => {
    assert.equal(substituteVariables('${workspaceFolderBasename} / $HOME / ${userHome}', ctx),
        'project / /Users/dev / /Users/dev');
    assert.equal(substituteVariables('key=${env:API_KEY} missing=${env:NOPE}', ctx),
        'key=secret missing=');
});

test('leaves unknown text untouched', () => {
    assert.equal(substituteVariables('git push --force-with-lease', ctx),
        'git push --force-with-lease');
});

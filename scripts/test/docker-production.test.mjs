import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = (
  await readFile(new URL('../docker-production.mjs', import.meta.url), 'utf8')
).replace(/^import[^\n]+\n/, '');

async function execute(action, failService) {
  const calls = [];
  const process = { argv: ['node', 'script', action], env: {} };
  await vm.runInNewContext(`(async () => { ${source} })()`, {
    process,
    console: { log() {}, error() {} },
    readProductionEnv: async () => ({}),
    run: async (command, args) => {
      assert.equal(command, 'docker');
      calls.push(Array.from(args.slice(5)));
      if (args.includes('build') && args.at(-1) === failService)
        throw new Error('Simulated build failure');
      await new Promise((resolve) => setTimeout(resolve, 1));
    },
  });
  return { calls, exitCode: process.exitCode };
}

test('full deployment builds API then web and only then starts without rebuilding', async () => {
  const { calls, exitCode } = await execute('up');
  assert.equal(exitCode, undefined);
  assert.deepEqual(calls, [
    ['build', 'api'],
    ['build', 'web'],
    ['up', '-d', '--no-build', '--wait', '--wait-timeout', '240'],
  ]);
});

test('API-only deployment does not build or start web', async () => {
  const { calls } = await execute('api');
  assert.deepEqual(calls, [
    ['build', 'api'],
    ['up', '-d', '--no-build', '--wait', '--wait-timeout', '240', 'api'],
  ]);
});

test('a failed build prevents container replacement and further builds', async () => {
  for (const service of ['api', 'web']) {
    const { calls, exitCode } = await execute('up', service);
    assert.equal(exitCode, 1);
    assert.equal(calls.length, service === 'api' ? 1 : 2);
    assert.ok(calls.every((args) => args[0] === 'build'));
  }
});

test('configuration check does not build or start services', async () => {
  assert.deepEqual((await execute('check')).calls, [['config', '--quiet']]);
});

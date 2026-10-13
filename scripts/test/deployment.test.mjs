import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseEnv } from 'node:util';
import {
  deployment,
  root,
  publicApiUrl,
  readProductionEnv,
  releaseSigningGradle,
  run,
} from '../lib/deployment.mjs';

test('APK URLs preserve a public API path and reject invalid release endpoints', () => {
  assert.equal(publicApiUrl(deployment.apiUrl + '/'), deployment.apiUrl);
  assert.equal(publicApiUrl('https://example.org/api/'), 'https://example.org/api');
  for (const value of [
    'http://localhost:3301',
    '/api',
    'https://localhost',
    'https://a:b@example.org',
    'https://example.org/?token=private',
    'https://example.org/#x',
  ])
    assert.throws(() => publicApiUrl(value));
});

test('release signing overrides debug signing and survives repeated prebuild patching', () => {
  const original = 'android { buildTypes { release { signingConfig signingConfigs.debug } } }\n';
  const once = releaseSigningGradle(original);
  assert.equal(releaseSigningGradle(once), once);
  assert.ok(
    once.lastIndexOf('signingConfig signingConfigs.weldcostaRelease') >
      once.indexOf('signingConfig signingConfigs.debug'),
  );
  assert.ok(once.includes("System.getenv('WELDCOSTA_STORE_PASSWORD')"));
  assert.throws(() => releaseSigningGradle(original + '// WELDCOSTA RELEASE SIGNING BEGIN'));
});

test('production setup creates distinct secrets, preserves credentials and validates missing fields', async () => {
  const sandbox = await mkdtemp(path.join(tmpdir(), 'weldcosta-deploy-test-'));
  try {
    await mkdir(path.join(sandbox, 'scripts/lib'), { recursive: true });
    await mkdir(path.join(sandbox, 'config'));
    for (const file of [
      'scripts/lib/deployment.mjs',
      'scripts/setup-production.mjs',
      'config/deployment.json',
      '.env.production.example',
    ])
      await copyFile(path.join(root, file), path.join(sandbox, file));
    const args = [
      path.join(sandbox, 'scripts/setup-production.mjs'),
      '--admin-email',
      'admin@example.invalid',
    ];
    const output = await run(process.execPath, args, { cwd: sandbox, capture: true });
    const file = path.join(sandbox, '.env.production');
    const contents = await readFile(file, 'utf8');
    const values = parseEnv(contents);
    assert.notEqual(values.JWT_SECRET, values.REFRESH_TOKEN_SECRET);
    assert.ok(values.ADMIN_PASSWORD.length >= 12);
    assert.ok(!output.includes(values.ADMIN_PASSWORD));
    assert.equal((await readProductionEnv(file)).ADMIN_EMAIL, 'admin@example.invalid');
    await run(process.execPath, args, { cwd: sandbox, capture: true });
    assert.equal(await readFile(file, 'utf8'), contents);
    await writeFile(file, contents.replace(/^ADMIN_EMAIL=.*$/m, 'ADMIN_EMAIL='));
    await assert.rejects(readProductionEnv(file), /ADMIN_EMAIL/);
    await writeFile(file, contents.replace(values.REFRESH_TOKEN_SECRET, values.JWT_SECRET));
    await assert.rejects(readProductionEnv(file), /diferentes/);
  } finally {
    const resolved = path.resolve(sandbox);
    assert.equal(path.dirname(resolved), path.resolve(tmpdir()));
    assert.ok(path.basename(resolved).startsWith('weldcosta-deploy-test-'));
    await rm(resolved, { recursive: true, force: true });
  }
});

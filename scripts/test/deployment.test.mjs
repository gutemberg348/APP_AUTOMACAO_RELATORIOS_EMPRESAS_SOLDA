import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { createRequire } from 'node:module';
import {
  deployment,
  root,
  publicApiUrl,
  readProductionEnv,
  releaseSigningGradle,
  run,
} from '../lib/deployment.mjs';
import {
  androidBuildPath,
  resetAndroidPathCaches,
  androidWindowsPathsGradle,
  remapAutolinkingPaths,
} from '../lib/android-build-path.mjs';

const require = createRequire(import.meta.url);
const { resetAdminPassword } = require('../reset-admin-password.cjs');
const bcrypt = require('bcryptjs');

test('explicit admin recovery applies ENV password, activates the account and revokes its refresh tokens', async () => {
  const oldHash = await bcrypt.hash('old-example-password', 4);
  const user = {
    id: 'admin-id',
    email: 'admin@example.invalid',
    passwordHash: oldHash,
    status: 'DISABLED',
    role: { code: 'ADMIN' },
  };
  const writes = [];
  const prisma = {
    $transaction: async (fn) =>
      fn({
        user: {
          findUnique: async ({ where }) => (where.email === user.email ? user : null),
          update: async ({ where, data }) => {
            assert.equal(where.id, user.id);
            Object.assign(user, data);
          },
        },
        refreshToken: { updateMany: async (value) => writes.push(value) },
        auditLog: { create: async (value) => writes.push(value) },
      }),
  };
  const password = 'new-example-password';
  assert.equal(
    await resetAdminPassword(prisma, {
      ADMIN_EMAIL: ' ADMIN@EXAMPLE.INVALID ',
      ADMIN_PASSWORD: password,
    }),
    user.email,
  );
  assert.equal(user.status, 'ACTIVE');
  assert.equal(await bcrypt.compare(password, user.passwordHash), true);
  assert.equal(await bcrypt.compare('old-example-password', user.passwordHash), false);
  assert.deepEqual(writes[0].where, { userId: user.id, revokedAt: null });
  assert.ok(writes[0].data.revokedAt instanceof Date);
  assert.equal(writes[1].data.action, 'RESET_ADMIN_PASSWORD_FROM_ENV');
  assert.ok(!JSON.stringify(writes).includes(password));
});

test('admin recovery refuses invalid credentials, missing users and non-admin accounts before writing', async () => {
  const unexpected = () => assert.fail('Unexpected database write');
  for (const env of [
    {},
    { ADMIN_EMAIL: 'admin@example.invalid', ADMIN_PASSWORD: 'short' },
    { ADMIN_EMAIL: 'admin@example.invalid', ADMIN_PASSWORD: 'é'.repeat(40) },
  ])
    await assert.rejects(
      resetAdminPassword({ $transaction: unexpected }, env),
      /ADMIN_EMAIL|ADMIN_PASSWORD/,
    );
  for (const user of [null, { id: 'operator-id', role: { code: 'OPERATOR' } }]) {
    const prisma = {
      $transaction: async (fn) =>
        fn({
          user: { findUnique: async () => user, update: unexpected },
          refreshToken: { updateMany: unexpected },
          auditLog: { create: unexpected },
        }),
    };
    await assert.rejects(
      resetAdminPassword(prisma, {
        ADMIN_EMAIL: 'admin@example.invalid',
        ADMIN_PASSWORD: 'new-example-password',
      }),
      /não encontrado|outra função/,
    );
  }
});

test('autolinking uses one Windows drive for workspace paths, preserving unrelated paths and values', () => {
  const config = {
    root: 'C:\\work\\app',
    dependency: {
      sourceDir: 'C:/work/app/node_modules/native/android',
      descriptors: ['NativeComponent'],
      disabled: false,
    },
    external: 'C:/work/app-other/android',
    sdk: 'C:/Android/Sdk',
    optional: null,
  };
  assert.deepEqual(remapAutolinkingPaths(config, 'C:\\work\\app', 'W:\\'), {
    root: 'W:/',
    dependency: {
      sourceDir: 'W:/node_modules/native/android',
      descriptors: ['NativeComponent'],
      disabled: false,
    },
    external: 'C:/work/app-other/android',
    sdk: 'C:/Android/Sdk',
    optional: null,
  });
});

test('Windows build mapping shortens Node paths and only releases the drive it created', async () => {
  if (process.platform !== 'win32') return;
  const mapped = await androidBuildPath(root);
  try {
    assert.match(mapped.root, /^[A-Z]:\\$/i);
    const reused = await androidBuildPath(root);
    assert.equal(reused.root, mapped.root);
    await reused.release();
    const resolved = JSON.parse(
      await run(
        process.execPath,
        [
          '-p',
          'JSON.stringify({cwd:process.cwd(),rn:require.resolve("react-native/package.json")})',
        ],
        { cwd: mapped.root, capture: true },
      ),
    );
    assert.equal(resolved.cwd, mapped.root);
    assert.ok(resolved.rn.startsWith(mapped.root));
  } finally {
    await mapped.release();
  }
});

test('Expo bundle launcher canonicalizes its working directory and absolute mapped arguments', async () => {
  if (process.platform !== 'win32') return;
  const sandbox = await mkdtemp(path.join(tmpdir(), 'weldcosta-bundle-path-test-'));
  let mapped;
  try {
    await mkdir(path.join(sandbox, 'scripts'));
    await mkdir(path.join(sandbox, 'apps/app'), { recursive: true });
    await mkdir(path.join(sandbox, 'node_modules/expo/bin'), { recursive: true });
    await copyFile(
      path.join(root, 'scripts/expo-android-bundle.cjs'),
      path.join(sandbox, 'scripts/expo-android-bundle.cjs'),
    );
    await writeFile(
      path.join(sandbox, 'node_modules/expo/bin/cli'),
      'console.log(JSON.stringify({cwd:process.cwd(),args:process.argv.slice(2)}));',
    );
    mapped = await androidBuildPath(sandbox);
    const output = JSON.parse(
      await run(
        process.execPath,
        [
          path.join(mapped.root, 'scripts/expo-android-bundle.cjs'),
          'export:embed',
          '--entry-file',
          path.join(mapped.root, 'apps/app/index.ts'),
          '--assets-dest',
          './android/assets',
        ],
        {
          cwd: path.join(mapped.root, 'apps/app'),
          capture: true,
          env: { ...process.env, WELDCOSTA_ANDROID_BUILD_ROOT: mapped.root },
        },
      ),
    );
    assert.equal(output.cwd, path.join(sandbox, 'apps/app'));
    assert.deepEqual(output.args, [
      'export:embed',
      '--entry-file',
      path.join(sandbox, 'apps/app/index.ts'),
      '--assets-dest',
      './android/assets',
    ]);
  } finally {
    if (mapped) await mapped.release();
    assert.equal(path.dirname(path.resolve(sandbox)), path.resolve(tmpdir()));
    assert.ok(path.basename(sandbox).startsWith('weldcosta-bundle-path-test-'));
    await rm(sandbox, { recursive: true, force: true });
  }
});

test('Android path migration removes generated native caches, preserves source and signing, and reuses the same path', async () => {
  const sandbox = await mkdtemp(path.join(tmpdir(), 'weldcosta-android-path-test-'));
  try {
    const files = [
      'apps/app/android/app/.cxx/old/CMakeCache.txt',
      'apps/app/android/build/generated/autolinking/autolinking.json',
      'node_modules/native-library/android/.cxx/old/build.ninja',
      'apps/app/node_modules/@scope/native-library/android/build/intermediates/cxx/old/file',
      'apps/app/android/app/src/main/AndroidManifest.xml',
      '.android-signing/weldcosta-release.jks',
    ];
    for (const file of files) {
      await mkdir(path.dirname(path.join(sandbox, file)), { recursive: true });
      await writeFile(path.join(sandbox, file), 'preserve');
    }
    const state = path.join(sandbox, '.android-signing/build-path.json');
    await resetAndroidPathCaches(sandbox, sandbox, state);
    for (const file of files.slice(0, 4))
      await assert.rejects(readFile(path.join(sandbox, file)), { code: 'ENOENT' });
    for (const file of files.slice(4))
      assert.equal(await readFile(path.join(sandbox, file), 'utf8'), 'preserve');
    const regenerated = path.join(sandbox, files[0]);
    await mkdir(path.dirname(regenerated), { recursive: true });
    await writeFile(regenerated, 'new cache');
    await resetAndroidPathCaches(sandbox, sandbox, state);
    assert.equal(await readFile(regenerated, 'utf8'), 'new cache');
    const gradle = androidWindowsPathsGradle('apply plugin: "expo-root-project"\n');
    assert.equal(androidWindowsPathsGradle(gradle), gradle);
    assert.ok(gradle.includes('-DCMAKE_OBJECT_PATH_MAX=240'));
  } finally {
    assert.equal(path.dirname(path.resolve(sandbox)), path.resolve(tmpdir()));
    assert.ok(path.basename(sandbox).startsWith('weldcosta-android-path-test-'));
    await rm(sandbox, { recursive: true, force: true });
  }
});

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

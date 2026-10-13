import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const name = `weldcosta-test-${randomBytes(6).toString('hex')}`;
const password = randomBytes(24).toString('hex');
const testStorage = mkdtempSync(path.join(tmpdir(), 'weldcosta-test-storage-'));
const run = (command, args, env = process.env, output = 'inherit') =>
  execFileSync(command, args, { cwd: root, env, stdio: output });
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run through npm run test:integration.');
const npm = (args, env) => run(process.execPath, [npmCli, ...args], env);
try {
  run(
    'docker',
    [
      'run',
      '-d',
      '--rm',
      '--name',
      name,
      '-e',
      `POSTGRES_PASSWORD=${password}`,
      '-e',
      'POSTGRES_USER=weldcosta',
      '-e',
      'POSTGRES_DB=weldcosta_test',
      '-p',
      '127.0.0.1::5432',
      'postgres:17-alpine',
    ],
    process.env,
    'pipe',
  );
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try {
      run('docker', ['exec', name, 'pg_isready', '-U', 'weldcosta'], process.env, 'pipe');
      ready = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  if (!ready) throw new Error('Test PostgreSQL did not start.');
  const port = run('docker', ['port', name, '5432/tcp'], process.env, 'pipe')
    .toString()
    .trim()
    .split(':')
    .at(-1);
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    TRUST_PROXY_HOPS: '1',
    DATABASE_URL: `postgresql://weldcosta:${password}@localhost:${port}/weldcosta_test`,
    JWT_SECRET: randomBytes(48).toString('hex'),
    REFRESH_TOKEN_SECRET: randomBytes(48).toString('hex'),
    ADMIN_EMAIL: '',
    ADMIN_PASSWORD: '',
    STORAGE_PATH: testStorage,
  };
  npm(['run', 'db:deploy'], env);
  npm(['run', 'db:seed'], env);
  npm(['exec', '--workspace', '@weldcosta/api', '--', 'vitest', 'run', 'test/integration'], env);
} finally {
  try {
    run('docker', ['stop', name], process.env, 'pipe');
  } catch {
    /* Already stopped. */
  }
  if (
    path.resolve(testStorage).startsWith(path.resolve(tmpdir()) + path.sep) &&
    path.basename(testStorage).startsWith('weldcosta-test-storage-')
  )
    rmSync(testStorage, { recursive: true, force: true });
}

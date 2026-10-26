import { spawn } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
import { deployment, publicApiUrl, root } from './lib/deployment.mjs';

const args = process.argv.slice(2);
const require = createRequire(import.meta.url);
const apiUrl = publicApiUrl(deployment.apiUrl);
console.log(`Expo Go — API online: ${apiUrl}`);
console.log('Os cadastros e alterações feitos no app serão gravados no servidor online.');

try {
  const response = await fetch(apiUrl + '/health', { signal: AbortSignal.timeout(15000) });
  const body = await response.json();
  if (!response.ok || body?.success !== true || body?.data?.status !== 'ok')
    throw new Error(`Resposta inesperada em /health (HTTP ${response.status}).`);
  console.log('API online respondeu normalmente.');
  if (!args.includes('--check')) {
    const child = spawn(
      process.execPath,
      [
        require.resolve('expo/bin/cli', { paths: [path.join(root, 'apps/app')] }),
        'start',
        '--go',
        '--lan',
        '--port',
        '8085',
        '--clear',
        ...args,
      ],
      {
        cwd: path.join(root, 'apps/app'),
        stdio: 'inherit',
        env: { ...process.env, EXPO_PUBLIC_API_URL: apiUrl },
      },
    );
    child.on('error', (error) => {
      console.error(`Não foi possível iniciar o Expo: ${error.message}`);
      process.exitCode = 1;
    });
    child.on('exit', (code) => {
      process.exitCode = code ?? 1;
    });
  }
} catch (error) {
  console.error(`Não foi possível verificar a API online: ${error.message}`);
  console.error('Confira sua conexão e a API na VPS; depois execute npm run dev:mobile novamente.');
  process.exitCode = 1;
}

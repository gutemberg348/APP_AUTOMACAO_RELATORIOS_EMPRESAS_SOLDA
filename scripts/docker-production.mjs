import { readProductionEnv, run } from './lib/deployment.mjs';

try {
  const action = process.argv[2];
  const actions = {
    up: ['up', '-d', '--build', '--wait', '--wait-timeout', '240'],
    check: ['config', '--quiet'],
    logs: ['logs', '-f', '--tail', '100', 'api', 'web'],
    stop: ['stop'],
  };
  if (!actions[action]) throw new Error('Ação Docker inválida.');
  const values = await readProductionEnv();
  await run(
    'docker',
    [
      'compose',
      '--env-file',
      '.env.production',
      '-f',
      'docker-compose.production.yml',
      ...actions[action],
    ],
    { env: { ...process.env, ...values } },
  );
  if (action === 'check') console.log('Configuração de produção válida.');
  if (action === 'up')
    console.log(
      'Containers disponíveis. Configure Nginx/HTTPS na VPS conforme docs/publicacao-vps-apk.md.',
    );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

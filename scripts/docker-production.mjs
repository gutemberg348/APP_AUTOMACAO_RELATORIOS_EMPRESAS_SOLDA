import { readProductionEnv, run } from './lib/deployment.mjs';

try {
  const action = process.argv[2];
  const actions = {
    up: [
      ['build', 'api'],
      ['build', 'web'],
      ['up', '-d', '--no-build', '--wait', '--wait-timeout', '240'],
    ],
    api: [
      ['build', 'api'],
      ['up', '-d', '--no-build', '--wait', '--wait-timeout', '240', 'api'],
    ],
    check: [['config', '--quiet']],
    logs: [['logs', '-f', '--tail', '100', 'api', 'web']],
    stop: [['stop']],
  };
  if (!actions[action]) throw new Error('Ação Docker inválida.');
  const values = await readProductionEnv();
  // Build one service at a time so Metro and TypeScript don't compete on small VPSs.
  // Only replace running containers once every requested build has succeeded.
  for (const args of actions[action]) {
    if (args[0] === 'build') console.log(`Compilando ${args[1]}...`);
    await run(
      'docker',
      ['compose', '--env-file', '.env.production', '-f', 'docker-compose.production.yml', ...args],
      { env: { ...process.env, ...values } },
    );
  }
  if (action === 'check') console.log('Configuração de produção válida.');
  if (action === 'api') console.log('API atualizada. O painel web não foi reconstruído.');
  if (action === 'up')
    console.log(
      'Containers disponíveis. Configure Nginx/HTTPS na VPS conforme docs/publicacao-vps-apk.md.',
    );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

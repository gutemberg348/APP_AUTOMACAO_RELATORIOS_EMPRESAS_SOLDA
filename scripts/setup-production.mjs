import { readFile, writeFile, access } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import { root, deployment } from './lib/deployment.mjs';

try {
  const { values } = parseArgs({ options: { 'admin-email': { type: 'string' } } });
  const file = `${root}.env.production`;
  let exists = false;
  try {
    await access(file);
    exists = true;
  } catch {
    /* New environment. */
  }
  if (exists) console.log('.env.production já existe; segredos e credenciais preservados.');
  else {
    const email = values['admin-email'] ?? '';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new Error('Informe um e-mail válido.');
    const template = await readFile(`${root}.env.production.example`, 'utf8');
    const secrets = {
      POSTGRES_PASSWORD: randomBytes(32).toString('hex'),
      JWT_SECRET: randomBytes(48).toString('hex'),
      REFRESH_TOKEN_SECRET: randomBytes(48).toString('hex'),
      ADMIN_PASSWORD: randomBytes(18).toString('base64url'),
      ADMIN_EMAIL: email,
      CORS_ORIGIN: deployment.webUrl,
    };
    let contents = template;
    for (const [key, value] of Object.entries(secrets))
      contents = contents.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${value}`);
    await writeFile(file, contents, { flag: 'wx', mode: 0o600 });
    console.log('.env.production criado. A senha inicial está em ADMIN_PASSWORD nesse arquivo.');
    if (!email) console.log('Preencha ADMIN_EMAIL antes de subir os containers.');
  }
  console.log(`Painel: ${deployment.webUrl}\nAPI/APK: ${deployment.apiUrl}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

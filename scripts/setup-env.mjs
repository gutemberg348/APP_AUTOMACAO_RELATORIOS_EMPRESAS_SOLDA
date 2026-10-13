import { readFile, writeFile, access } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
try {
  await access(`${root}.env`);
  console.log('.env já existe; arquivo preservado.');
} catch {
  const password = randomBytes(24).toString('hex');
  const contents = (await readFile(`${root}.env.example`, 'utf8'))
    .replaceAll('local_change_me', password)
    .replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${randomBytes(48).toString('hex')}`)
    .replace(
      /^REFRESH_TOKEN_SECRET=.*$/m,
      `REFRESH_TOKEN_SECRET=${randomBytes(48).toString('hex')}`,
    );
  await writeFile(`${root}.env`, contents, { flag: 'wx' });
  console.log(
    '.env local criado com segredos aleatórios. Defina ADMIN_EMAIL/ADMIN_PASSWORD antes do seed se desejar criar o administrador.',
  );
}

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { spawn } from 'node:child_process';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const deployment = JSON.parse(
  await readFile(new URL('../../config/deployment.json', import.meta.url), 'utf8'),
);

export function publicApiUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Informe uma URL absoluta HTTPS para a API.');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
    throw new Error('A URL da API deve usar HTTPS, sem credenciais, consulta ou fragmento.');
  if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    throw new Error('O APK deve apontar para a API publicada, e não para localhost.');
  return url.toString().replace(/\/+$/, '');
}

export async function readProductionEnv(file = new URL('../../.env.production', import.meta.url)) {
  let values;
  try {
    values = parseEnv(await readFile(file, 'utf8'));
  } catch {
    throw new Error('Crie .env.production com npm run setup:production.');
  }
  for (const name of ['JWT_SECRET', 'REFRESH_TOKEN_SECRET'])
    if ((values[name]?.length ?? 0) < 32)
      throw new Error(`Preencha ${name} com pelo menos 32 caracteres.`);
  if (values.JWT_SECRET === values.REFRESH_TOKEN_SECRET)
    throw new Error('Os segredos de acesso e refresh precisam ser diferentes.');
  if (!/^[a-zA-Z0-9_-]{32,}$/.test(values.POSTGRES_PASSWORD ?? ''))
    throw new Error(
      'POSTGRES_PASSWORD deve usar pelo menos 32 letras/números, hífen ou underscore.',
    );
  for (const name of ['POSTGRES_USER', 'POSTGRES_DB'])
    if (!/^[a-zA-Z0-9_]+$/.test(values[name] ?? '')) throw new Error(`Confira ${name}.`);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.ADMIN_EMAIL ?? ''))
    throw new Error('Preencha ADMIN_EMAIL em .env.production para criar o primeiro administrador.');
  if (
    (values.ADMIN_PASSWORD?.length ?? 0) < 12 ||
    Buffer.byteLength(values.ADMIN_PASSWORD ?? '') > 72
  )
    throw new Error('ADMIN_PASSWORD deve ter ao menos 12 caracteres e no máximo 72 bytes.');
  if (values.CORS_ORIGIN !== deployment.webUrl)
    throw new Error(`CORS_ORIGIN deve ser ${deployment.webUrl}.`);
  return values;
}

export function run(command, args, { cwd = root, env = process.env, capture = false } = {}) {
  // Only fixed batch commands (npm.cmd/gradlew.bat) use cmd on Windows.
  const batch = process.platform === 'win32' && /\.(cmd|bat)$/i.test(command);
  const child = spawn(
    batch ? (process.env.ComSpec ?? 'cmd.exe') : command,
    batch ? ['/d', '/c', command, ...args] : args,
    { cwd, env, windowsHide: true, stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit' },
  );
  return new Promise((resolve, reject) => {
    let output = '';
    if (capture) {
      child.stdout.on('data', (chunk) => {
        output += chunk;
      });
      child.stderr.on('data', (chunk) => {
        output += chunk;
      });
    }
    child.on('error', (error) =>
      reject(new Error(`Não foi possível executar ${command}: ${error.message}`)),
    );
    child.on('close', (code) =>
      code === 0
        ? resolve(output)
        : reject(new Error(`${command} falhou (código ${code}).${capture ? '\n' + output : ''}`)),
    );
  });
}

export const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

export function releaseSigningGradle(contents) {
  const begin = '// WELDCOSTA RELEASE SIGNING BEGIN',
    end = '// WELDCOSTA RELEASE SIGNING END';
  const start = contents.indexOf(begin);
  if (start !== -1) {
    const finish = contents.indexOf(end, start);
    if (finish === -1)
      throw new Error('Configuração de assinatura incompleta em android/app/build.gradle.');
    contents = contents.slice(0, start) + contents.slice(finish + end.length);
  }
  return (
    contents.trimEnd() +
    `\n\n${begin}
android {
    signingConfigs {
        weldcostaRelease {
            def storePath = System.getenv('WELDCOSTA_STORE_FILE')
            if (storePath) storeFile file(storePath)
            storePassword System.getenv('WELDCOSTA_STORE_PASSWORD')
            keyAlias System.getenv('WELDCOSTA_KEY_ALIAS')
            keyPassword System.getenv('WELDCOSTA_KEY_PASSWORD')
        }
    }
    buildTypes {
        release { signingConfig signingConfigs.weldcostaRelease }
    }
}
tasks.matching { it.name == 'createBundleReleaseJsAndAssets' }.configureEach {
    inputs.property('weldcostaApiUrl', System.getenv('EXPO_PUBLIC_API_URL') ?: '')
}
def shortBuildRoot = System.getenv('WELDCOSTA_ANDROID_BUILD_ROOT')
if (shortBuildRoot) {
    react { cliFile = file(shortBuildRoot + '/scripts/expo-android-bundle.cjs') }
    // RN configures app CMake arguments after the root project's plugin hook.
    android.defaultConfig.externalNativeBuild.cmake.arguments '-DCMAKE_OBJECT_PATH_MAX=240'
}
${end}\n`
  );
}

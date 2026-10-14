import { access, readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  root,
  deployment,
  publicApiUrl,
  releaseSigningGradle,
  run,
  npmCommand,
} from './lib/deployment.mjs';
import {
  androidBuildPath,
  resetAndroidPathCaches,
  androidWindowsPathsGradle,
  prepareWindowsAutolinking,
} from './lib/android-build-path.mjs';

const signingRoot = path.join(root, '.android-signing');
let buildPath;
const exists = (file) =>
  access(file).then(
    () => true,
    () => false,
  );

async function toolchain() {
  const androidSdk =
    process.env.ANDROID_HOME ||
    process.env.ANDROID_SDK_ROOT ||
    (process.platform === 'win32' && process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'Android/Sdk')
      : undefined);
  if (!androidSdk || !(await exists(path.join(androidSdk, 'platform-tools'))))
    throw new Error('Configure ANDROID_HOME com o caminho do Android SDK instalado.');
  const javaHome = process.env.JAVA_HOME;
  const executable = (name) =>
    javaHome
      ? path.join(javaHome, 'bin', name + (process.platform === 'win32' ? '.exe' : ''))
      : name;
  const version = await run(executable('java'), ['-version'], { capture: true });
  const major = Number(/version "(\d+)/.exec(version)?.[1]);
  if (major < 17 || !major) throw new Error('O build exige JDK 17 ou superior. Confira JAVA_HOME.');
  return { androidSdk, keytool: executable('keytool'), major };
}

async function signing(keytool) {
  const file = path.join(signingRoot, 'credentials.json');
  const keystore = path.join(signingRoot, 'weldcosta-release.jks');
  await mkdir(signingRoot, { recursive: true, mode: 0o700 });
  if (await exists(file)) {
    const credentials = JSON.parse(await readFile(file, 'utf8'));
    if (!(await exists(keystore)) || !credentials.password || !credentials.alias)
      throw new Error(
        'Assinatura incompleta. Restaure o backup de .android-signing; não gere outra chave para atualizar o app.',
      );
    return { ...credentials, keystore };
  }
  if (await exists(keystore))
    throw new Error(
      'A chave já existe, mas credentials.json está ausente. Restaure as credenciais.',
    );
  const credentials = { alias: 'weldcosta', password: randomBytes(24).toString('base64url') };
  await run(
    keytool,
    [
      '-genkeypair',
      '-storetype',
      'PKCS12',
      '-keystore',
      keystore,
      '-alias',
      credentials.alias,
      '-keyalg',
      'RSA',
      '-keysize',
      '3072',
      '-validity',
      '10000',
      '-dname',
      'CN=Weldcosta, OU=Inspecoes, O=Weldcosta, C=BR',
      '-noprompt',
      '-storepass:env',
      'WELDCOSTA_KEYSTORE_PASSWORD',
      '-keypass:env',
      'WELDCOSTA_KEYSTORE_PASSWORD',
    ],
    { env: { ...process.env, WELDCOSTA_KEYSTORE_PASSWORD: credentials.password } },
  );
  await writeFile(file, JSON.stringify(credentials, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log('Chave de assinatura criada em .android-signing. Guarde um backup dessa pasta.');
  return { ...credentials, keystore };
}

try {
  const { values } = parseArgs({
    options: {
      check: { type: 'boolean' },
      'api-url': { type: 'string' },
      'skip-api-check': { type: 'boolean' },
      'version-code': { type: 'string' },
      clean: { type: 'boolean' },
    },
  });
  const apiUrl = publicApiUrl(values['api-url'] ?? deployment.apiUrl);
  const tools = await toolchain();
  console.log(`API do APK: ${apiUrl}\nJDK: ${tools.major}\nAndroid SDK: ${tools.androidSdk}`);
  if (values.check)
    console.log('Pré-requisitos encontrados. O build usará o Gradle Wrapper do projeto.');
  else {
    if (!values['skip-api-check']) {
      try {
        const response = await fetch(apiUrl + '/health', {
          signal: AbortSignal.timeout(15000),
          redirect: 'error',
        });
        const body = await response.json();
        if (!response.ok || body?.success !== true || body.data?.status !== 'ok')
          throw new Error('Health inválido.');
      } catch {
        throw new Error(
          'A API HTTPS ainda não respondeu em /health. Publique primeiro. Para compilar antes da publicação, use --skip-api-check.',
        );
      }
    }
    const credentials = await signing(tools.keytool);
    buildPath = await androidBuildPath(root);
    const appRoot = path.join(buildPath.root, 'apps/app');
    console.log(`Pasta de compilação Android: ${appRoot}`);
    if (process.platform === 'win32')
      await resetAndroidPathCaches(root, buildPath.root, path.join(signingRoot, 'build-path.json'));
    const stateFile = path.join(signingRoot, 'last-build.json');
    const previous = (await exists(stateFile))
      ? JSON.parse(await readFile(stateFile, 'utf8'))
      : { versionCode: 0 };
    const versionCode = Number(values['version-code'] ?? previous.versionCode + 1);
    if (
      !Number.isInteger(versionCode) ||
      versionCode <= previous.versionCode ||
      versionCode > 2100000000
    )
      throw new Error(
        'Use um version-code inteiro maior que o último build e menor ou igual a 2100000000.',
      );
    const env = {
      ...process.env,
      ANDROID_HOME: tools.androidSdk,
      ANDROID_SDK_ROOT: tools.androidSdk,
      EXPO_PUBLIC_API_URL: apiUrl,
      EXPO_NO_DOTENV: '1',
      NODE_ENV: 'production',
      WELDCOSTA_ANDROID_VERSION_CODE: String(versionCode),
      WELDCOSTA_ANDROID_BUILD_ROOT: process.platform === 'win32' ? buildPath.root : '',
      WELDCOSTA_STORE_FILE: credentials.keystore,
      WELDCOSTA_STORE_PASSWORD: credentials.password,
      WELDCOSTA_KEY_ALIAS: credentials.alias,
      WELDCOSTA_KEY_PASSWORD: credentials.password,
    };
    await run(npmCommand, ['run', 'build', '--workspace', '@weldcosta/shared'], {
      env,
    });
    await run(
      process.execPath,
      [
        path.join(buildPath.root, 'node_modules/expo/bin/cli'),
        'prebuild',
        '--platform',
        'android',
        '--no-install',
        ...(values.clean ? [] : ['--no-clean']),
      ],
      { cwd: appRoot, env: { ...env, CI: '1' } },
    );
    const gradleFile = path.join(appRoot, 'android/app/build.gradle');
    await prepareWindowsAutolinking(root, buildPath.root);
    await writeFile(gradleFile, releaseSigningGradle(await readFile(gradleFile, 'utf8')));
    const rootGradleFile = path.join(appRoot, 'android/build.gradle');
    await writeFile(
      rootGradleFile,
      androidWindowsPathsGradle(await readFile(rootGradleFile, 'utf8')),
    );
    await run(
      process.platform === 'win32' ? 'gradlew.bat' : './gradlew',
      [
        ':app:assembleRelease',
        '--no-daemon',
        '--console=plain',
        // Expo modules resolve physical paths; Kotlin incremental caches cannot
        // relativize those sources against the SUBST drive used by React Native.
        ...(process.platform === 'win32' ? ['-Pkotlin.incremental=false'] : []),
      ],
      { cwd: path.join(appRoot, 'android'), env },
    );
    const apk = path.join(appRoot, 'android/app/build/outputs/apk/release/app-release.apk');
    const output = path.join(root, 'artifacts/android');
    await mkdir(output, { recursive: true });
    await copyFile(apk, path.join(output, 'weldcosta-release.apk'));
    const metadata = {
      apiUrl,
      versionCode,
      builtAt: new Date().toISOString(),
      sha256: createHash('sha256')
        .update(await readFile(apk))
        .digest('hex'),
    };
    await writeFile(path.join(output, 'build-info.json'), JSON.stringify(metadata, null, 2) + '\n');
    await writeFile(stateFile, JSON.stringify(metadata, null, 2) + '\n', { mode: 0o600 });
    console.log(
      `APK gerado: ${path.join(output, 'weldcosta-release.apk')}\nVersion code: ${versionCode}\nAPI: ${apiUrl}`,
    );
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (buildPath)
    await buildPath.release().catch((error) => {
      console.warn(`Não foi possível liberar a unidade temporária: ${error.message}`);
    });
}

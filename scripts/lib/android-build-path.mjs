import { access, readFile, writeFile, readdir, realpath, rm } from 'node:fs/promises';
import path from 'node:path';
import { run } from './deployment.mjs';

const exists = (file) =>
  access(file).then(
    () => true,
    () => false,
  );

// SUBST keeps both Gradle and Node/autolinking paths short, without moving the project.
export async function androidBuildPath(workspace) {
  if (process.platform !== 'win32') return { root: workspace, release: async () => {} };
  const subst = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32/subst.exe');
  const mappings = await run(subst, [], { capture: true });
  for (const line of mappings.split(/\r?\n/)) {
    const match = /^([A-Z]):\\: => (.+)$/i.exec(line.trim());
    if (match && path.resolve(match[2]).toLowerCase() === path.resolve(workspace).toLowerCase())
      return { root: `${match[1]}:\\`, release: async () => {} };
  }
  for (const letter of 'WVUTSRQPONMLKJIHGFEDZYX') {
    const drive = `${letter}:`;
    if (await exists(drive + '\\')) continue;
    try {
      await run(subst, [drive, path.resolve(workspace)], { capture: true });
    } catch {
      continue;
    }
    return {
      root: drive + '\\',
      release: async () => {
        await run(subst, [drive, '/d'], { capture: true });
      },
    };
  }
  throw new Error(
    'Não há uma letra de unidade disponível para encurtar o caminho do build Android.',
  );
}

export async function resetAndroidPathCaches(workspace, buildRoot, stateFile) {
  const state = JSON.stringify({ buildRoot: path.resolve(buildRoot), revision: 2 }) + '\n';
  if ((await readFile(stateFile, 'utf8').catch(() => '')) === state) return;
  const nativeRoots = [path.join(workspace, 'apps/app/android')];
  // npm hoists some native libraries and installs others inside the app workspace.
  for (const modules of ['node_modules', 'apps/app/node_modules']) {
    const directory = path.join(workspace, modules);
    for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const packagePath = path.join(directory, entry.name);
      const packages = entry.name.startsWith('@')
        ? (await readdir(packagePath, { withFileTypes: true }))
            .filter((child) => child.isDirectory())
            .map((child) => path.join(packagePath, child.name))
        : [packagePath];
      nativeRoots.push(...packages.map((directory) => path.join(directory, 'android')));
    }
  }
  const targets = [
    'apps/app/android/.gradle',
    'apps/app/android/build/generated/autolinking',
    'apps/app/android/app/build/generated/autolinking',
    'apps/app/android/app/.cxx',
    'apps/app/android/app/build/intermediates/cxx',
  ].map((directory) => path.join(workspace, directory));
  for (const directory of nativeRoots)
    targets.push(path.join(directory, '.cxx'), path.join(directory, 'build/intermediates/cxx'));
  const resolvedWorkspace = await realpath(workspace);
  let removed = 0;
  for (const target of new Set(targets)) {
    if (!(await exists(target))) continue;
    const resolvedTarget = await realpath(target);
    const relative = path.relative(resolvedWorkspace, resolvedTarget);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
      throw new Error(`Cache Android fora do projeto: ${target}`);
    await rm(target, { recursive: true, force: true });
    removed++;
  }
  await writeFile(stateFile, state, { mode: 0o600 });
  console.log(`Caminho de build atualizado; ${removed} caches de caminhos nativos renovados.`);
}

export function remapAutolinkingPaths(value, workspace, buildRoot) {
  if (Array.isArray(value))
    return value.map((item) => remapAutolinkingPaths(item, workspace, buildRoot));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        remapAutolinkingPaths(item, workspace, buildRoot),
      ]),
    );
  if (typeof value !== 'string') return value;
  const prefix = workspace.replace(/\\/g, '/').replace(/\/+$/, '');
  const normalized = value.replace(/\\/g, '/');
  if (normalized.toLowerCase() === prefix.toLowerCase()) return buildRoot.replace(/\\/g, '/');
  if (normalized.toLowerCase().startsWith(prefix.toLowerCase() + '/'))
    return buildRoot.replace(/\\/g, '/').replace(/\/+$/, '') + normalized.slice(prefix.length);
  return value;
}

// Expo canonicalizes dependency paths back to C:. Keep RN codegen on one drive.
export async function prepareWindowsAutolinking(workspace, buildRoot) {
  if (process.platform !== 'win32') return;
  const appRoot = path.join(buildRoot, 'apps/app');
  const cli = path.join(
    buildRoot,
    'node_modules/expo-modules-autolinking/bin/expo-modules-autolinking.js',
  );
  const output = await run(
    process.execPath,
    [cli, 'react-native-config', '--platform', 'android', '--json'],
    { cwd: appRoot, capture: true },
  );
  const config = remapAutolinkingPaths(JSON.parse(output), workspace, buildRoot);
  await writeFile(path.join(appRoot, 'android/weldcosta-autolinking.json'), JSON.stringify(config));
  const settingsFile = path.join(appRoot, 'android/settings.gradle');
  const from = 'ex.autolinkLibrariesFromCommand(expoAutolinking.rnConfigCommand)';
  const to = "ex.autolinkLibrariesFromConfigFile(new File(rootDir, 'weldcosta-autolinking.json'))";
  const contents = await readFile(settingsFile, 'utf8');
  if (!contents.includes(from) && !contents.includes(to))
    throw new Error(
      'Não foi possível configurar autolinking por caminho curto em android/settings.gradle.',
    );
  await writeFile(settingsFile, contents.replace(from, to));
}

export function androidWindowsPathsGradle(contents) {
  const begin = '// WELDCOSTA WINDOWS PATHS BEGIN';
  const end = '// WELDCOSTA WINDOWS PATHS END';
  const start = contents.indexOf(begin);
  if (start !== -1) {
    const finish = contents.indexOf(end, start);
    if (finish === -1)
      throw new Error('Configuração de caminhos incompleta em android/build.gradle.');
    contents = contents.slice(0, start) + contents.slice(finish + end.length);
  }
  return (
    contents.trimEnd() +
    `\n\n${begin}
if (System.getProperty('os.name').toLowerCase().contains('windows')) {
    subprojects { nativeProject ->
        ['com.android.application', 'com.android.library'].each { androidPlugin ->
            nativeProject.plugins.withId(androidPlugin) {
                nativeProject.extensions.getByName('android').defaultConfig.externalNativeBuild.cmake.arguments '-DCMAKE_OBJECT_PATH_MAX=240'
            }
        }
    }
}
${end}\n`
  );
}

import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const versionCode = Number(
    process.env.WELDCOSTA_ANDROID_VERSION_CODE ?? config.android?.versionCode ?? 1,
  );
  if (!Number.isInteger(versionCode) || versionCode < 1 || versionCode > 2100000000)
    throw new Error('WELDCOSTA_ANDROID_VERSION_CODE deve ser um inteiro de 1 a 2100000000.');
  return {
    ...config,
    name: config.name ?? 'Weldcosta Inspeções',
    slug: config.slug ?? 'weldcosta-system',
    android: { ...config.android, versionCode, softwareKeyboardLayoutMode: 'resize' },
  };
};

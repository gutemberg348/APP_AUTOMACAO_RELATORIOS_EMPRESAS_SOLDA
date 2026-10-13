import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type ThemeMode = 'light' | 'dark';
const key = 'weldcosta.theme';
let pending = Promise.resolve();

export const themeStorage = {
  async get(): Promise<ThemeMode | null> {
    try {
      const value =
        Platform.OS === 'web'
          ? globalThis.localStorage?.getItem(key)
          : await SecureStore.getItemAsync(key);
      return value === 'light' || value === 'dark' ? value : null;
    } catch {
      return null;
    }
  },
  set(mode: ThemeMode) {
    // Keep rapid toggles in order, including asynchronous native storage.
    pending = pending.then(async () => {
      try {
        if (Platform.OS === 'web') globalThis.localStorage?.setItem(key, mode);
        else await SecureStore.setItemAsync(key, mode);
      } catch {
        // The theme remains usable when preference storage is unavailable.
      }
    });
    return pending;
  },
};

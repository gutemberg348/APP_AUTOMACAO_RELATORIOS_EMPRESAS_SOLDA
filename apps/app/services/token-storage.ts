import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { AuthSession } from '@weldcosta/shared';
const key = 'weldcosta.session';
export const tokenStorage = {
  async get(): Promise<AuthSession | null> {
    try {
      const raw =
        Platform.OS === 'web'
          ? globalThis.sessionStorage?.getItem(key)
          : await SecureStore.getItemAsync(key);
      return raw ? (JSON.parse(raw) as AuthSession) : null;
    } catch {
      return null;
    }
  },
  async set(session: AuthSession) {
    const raw = JSON.stringify(session);
    if (Platform.OS === 'web') globalThis.sessionStorage?.setItem(key, raw);
    else await SecureStore.setItemAsync(key, raw);
  },
  async clear() {
    if (Platform.OS === 'web') globalThis.sessionStorage?.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  },
};

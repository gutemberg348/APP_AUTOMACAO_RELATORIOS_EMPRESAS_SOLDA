import { create } from 'zustand';
import type { AuthSession } from '@weldcosta/shared';
import { tokenStorage } from '../services/token-storage';
interface AuthState {
  session: AuthSession | null;
  ready: boolean;
  hydrate(): Promise<void>;
  setSession(session: AuthSession): Promise<void>;
  clear(): Promise<void>;
}
export const useAuth = create<AuthState>((set) => ({
  session: null,
  ready: false,
  async hydrate() {
    set({ session: await tokenStorage.get(), ready: true });
  },
  async setSession(session) {
    await tokenStorage.set(session);
    set({ session });
  },
  async clear() {
    await tokenStorage.clear();
    set({ session: null });
  },
}));

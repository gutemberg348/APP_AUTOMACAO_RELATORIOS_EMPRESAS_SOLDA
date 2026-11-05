import type { ApiResponse, AuthSession } from '@weldcosta/shared';
import { useAuth } from '../stores/auth';
import { Platform } from 'react-native';
import { fetch as expoFetch } from 'expo/fetch';
import Constants from 'expo-constants';
import { resolveApiUrl } from './resolve-api-url';
import { cacheApiData, cachedApiData, cacheablePath, offlineScope } from './offline-cache';
import { offlineDisk, offlineHash } from './offline-disk';
import { useConnectivity, offlineStorageFailure } from '../stores/connectivity';
export const apiUrl = resolveApiUrl(
  process.env.EXPO_PUBLIC_API_URL,
  typeof __DEV__ !== 'undefined' && __DEV__,
  Platform.OS,
  Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost,
  Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.hostname : undefined,
);
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
async function request<T>(
  path: string,
  init: RequestInit,
  token?: string,
  binary = false,
): Promise<T> {
  let response: Response;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    init.body instanceof FormData ? 60000 : 12000,
  );
  try {
    if (!useConnectivity.getState().online && path !== '/health') throw new Error('OFFLINE');
    const fetchRequest = Platform.OS === 'web' ? globalThis.fetch : expoFetch;
    response = await fetchRequest(`${apiUrl}${path}`, {
      ...init,
      signal: init.signal ?? controller.signal,
      headers: {
        ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    useConnectivity.setState({ online: false });
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Não foi possível conectar à API. Confira sua conexão e o endereço do servidor.',
    );
  } finally {
    clearTimeout(timeout);
  }
  if (binary && response.ok) return (await response.blob()) as T;
  let body: ApiResponse<T>;
  try {
    body = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError(
      response.status,
      'INVALID_RESPONSE',
      'O servidor retornou uma resposta inválida.',
    );
  }
  if (!body.success)
    throw new ApiError(response.status, body.error.code, body.error.message, body.error.details);
  return body.data;
}
let refreshPending: Promise<AuthSession> | null = null;
export async function api<T>(
  path: string,
  init: RequestInit & { accountId?: string } = {},
  authenticated = true,
  binary = false,
): Promise<T> {
  const session = useAuth.getState().session;
  if (init.accountId && init.accountId !== session?.user.id)
    throw new ApiError(
      409,
      'ACCOUNT_CHANGED',
      'A conta mudou. Entre na conta original para continuar a sincronização.',
    );
  const transport = { ...init };
  delete transport.accountId;
  const scope = authenticated && session ? offlineScope(apiUrl, session.user.id) : undefined;
  const cacheGet = scope && (!init.method || init.method === 'GET') && cacheablePath(path);
  const onlineRequest = async (token?: string) => {
    const result = await request<T>(path, transport, token, binary);
    if (cacheGet) {
      try {
        if (binary)
          await offlineDisk.putBlob(scope!, 'remote-' + offlineHash(path), result as Blob);
        else await cacheApiData(scope!, path, result);
      } catch (cause) {
        offlineStorageFailure(cause);
      }
    }
    return result;
  };
  try {
    return await onlineRequest(authenticated ? session?.accessToken : undefined);
  } catch (error) {
    if (cacheGet && error instanceof ApiError && error.code === 'NETWORK_ERROR') {
      const cached = binary
        ? await offlineDisk.getBlob(scope!, 'remote-' + offlineHash(path))
        : await cachedApiData<T>(scope!, path);
      if (cached !== undefined) return cached as T;
    }
    if (!authenticated || !(error instanceof ApiError) || error.status !== 401 || !session)
      throw error;
    refreshPending ??= request<AuthSession>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    })
      .then(async (refreshed) => {
        if (useAuth.getState().session?.refreshToken !== session.refreshToken)
          throw new ApiError(401, 'SESSION_CHANGED', 'A sessão mudou. Entre novamente.');
        await useAuth.getState().setSession(refreshed);
        return refreshed;
      })
      .catch(async (cause) => {
        if (cause instanceof ApiError && cause.status === 401) await useAuth.getState().clear();
        throw cause;
      })
      .finally(() => {
        refreshPending = null;
      });
    const refreshed = await refreshPending;
    return onlineRequest(refreshed.accessToken);
  }
}
export const jsonBody = (method: string, data: unknown): RequestInit => ({
  method,
  body: JSON.stringify(data),
});
export const apiBlob = (path: string) => api<Blob>(path, {}, true, true);

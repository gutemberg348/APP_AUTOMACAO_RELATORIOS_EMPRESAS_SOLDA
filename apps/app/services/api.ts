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
  const pdf = /^\/reports\/[^/]+\/pdf(?:\/preview)?$/.test(path);
  const controller = new AbortController();
  let expired = false;
  const cancel = () => controller.abort();
  if (init.signal?.aborted) cancel();
  init.signal?.addEventListener('abort', cancel, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const interrupted = new Promise<never>((_, reject) => {
    const abort = () =>
      reject(
        new ApiError(
          0,
          expired ? (pdf ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR') : 'REQUEST_CANCELLED',
          expired
            ? pdf
              ? 'O PDF demorou mais que o esperado. Tente novamente; seu relatório continua salvo.'
              : 'A operação demorou mais que o esperado. Tente novamente.'
            : 'Operação cancelada. Seu relatório continua salvo.',
        ),
      );
    controller.signal.addEventListener('abort', abort, { once: true });
    if (controller.signal.aborted) abort();
    timer = setTimeout(
      () => {
        expired = true;
        controller.abort();
      },
      pdf ? 180000 : init.body instanceof FormData ? 60000 : 12000,
    );
  });
  try {
    // Bound both the response headers AND the body. Some native transports do not
    // reject a stalled body read on abort, so also race the complete operation.
    return await Promise.race([
      interrupted,
      (async () => {
        if (controller.signal.aborted) return await interrupted;
        if (!useConnectivity.getState().online && path !== '/health') throw new Error('OFFLINE');
        const fetchRequest = Platform.OS === 'web' ? globalThis.fetch : expoFetch;
        const response = await fetchRequest(`${apiUrl}${path}`, {
          ...init,
          signal: controller.signal,
          headers: {
            ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...init.headers,
          },
        });
        if (binary && response.ok) {
          if (pdf && !response.headers.get('content-type')?.includes('application/pdf'))
            throw new ApiError(
              502,
              'INVALID_PDF',
              'O servidor não entregou o PDF. Tente baixar novamente.',
            );
          const blob = await response.blob();
          if (pdf && !blob.size)
            throw new ApiError(
              502,
              'INVALID_PDF',
              'O PDF recebido está vazio. Tente baixar novamente.',
            );
          return blob as T;
        }
        let body: ApiResponse<T>;
        try {
          body = (await response.json()) as ApiResponse<T>;
        } catch {
          throw new ApiError(
            response.status,
            'INVALID_RESPONSE',
            pdf
              ? 'Não foi possível receber o PDF. Tente novamente em instantes.'
              : 'O servidor retornou uma resposta inválida.',
          );
        }
        if (!body.success)
          throw new ApiError(
            response.status,
            body.error.code,
            body.error.message,
            body.error.details,
          );
        return body.data;
      })(),
    ]);
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.code === 'NETWORK_ERROR') useConnectivity.setState({ online: false });
      throw error;
    }
    useConnectivity.setState({ online: false });
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Sem conexão no momento. Confira sua internet e tente novamente quando ela voltar.',
    );
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener('abort', cancel);
  }
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
export const apiBlob = (path: string, init: RequestInit = {}) => api<Blob>(path, init, true, true);

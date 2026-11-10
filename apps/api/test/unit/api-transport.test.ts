import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  platform: { OS: 'ios' },
  expoFetch: vi.fn(),
  nativeFetch: vi.fn(),
}));
vi.mock('react-native', () => ({ Platform: state.platform }));
vi.mock('expo/fetch', () => ({ fetch: state.expoFetch }));
vi.mock('expo-constants', () => ({ default: { expoConfig: null, expoGoConfig: null } }));
vi.mock('../../../app/services/offline-disk', () => ({ offlineDisk: {}, offlineHash: () => 'qa' }));
vi.mock('../../../app/services/offline-cache', () => ({
  cacheablePath: () => false,
  offlineScope: () => 'qa',
}));
vi.mock('../../../app/stores/auth', () => ({
  useAuth: {
    getState: () => ({
      session: { accessToken: 'test-access', refreshToken: 'test-refresh', user: { id: 'qa' } },
    }),
  },
}));
import { useConnectivity } from '../../../app/stores/connectivity';
import { api, apiBlob } from '../../../app/services/api';
const result = () =>
  new Response(JSON.stringify({ success: true, data: { id: 'saved' } }), {
    headers: { 'Content-Type': 'application/json' },
  });
beforeEach(() => {
  useConnectivity.setState({ online: true });
  state.platform.OS = 'ios';
  state.expoFetch.mockReset().mockResolvedValue(result());
  state.nativeFetch.mockReset().mockResolvedValue(result());
  vi.stubGlobal('fetch', state.nativeFetch);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe('API transport for the installed Expo SDK', () => {
  it('does not send an offline queue using another account after login changes', async () => {
    await expect(
      api('/reports/test', { method: 'PUT', accountId: 'another-account' }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_CHANGED' });
    expect(state.expoFetch).not.toHaveBeenCalled();
    expect(state.nativeFetch).not.toHaveBeenCalled();
  });
  it.each(['ios', 'android'])(
    'uses Expo fetch with auth and automatic multipart boundary on %s',
    async (platform) => {
      state.platform.OS = platform;
      const body = new FormData();
      body.append('file', new Blob(['photo']), 'photo.jpg');
      await expect(api('/reports/test/media', { method: 'POST', body })).resolves.toEqual({
        id: 'saved',
      });
      expect(state.nativeFetch).not.toHaveBeenCalled();
      const options = state.expoFetch.mock.calls[0]![1];
      expect(options.headers.Authorization).toBe('Bearer test-access');
      expect(options.headers['Content-Type']).toBeUndefined();
      expect(options.body).toBe(body);
    },
  );
  it('keeps the browser transport for web', async () => {
    state.platform.OS = 'web';
    await api('/reports/test', { method: 'PUT', body: JSON.stringify({ version: 1 }) });
    expect(state.expoFetch).not.toHaveBeenCalled();
    expect(state.nativeFetch.mock.calls[0]![1].headers['Content-Type']).toBe('application/json');
  });
});

describe('PDF request deadlines', () => {
  it.each(['ios', 'android', 'web'])(
    'allows a slow PDF beyond 12 seconds on %s',
    async (platform) => {
      vi.useFakeTimers();
      state.platform.OS = platform;
      const fetch = platform === 'web' ? state.nativeFetch : state.expoFetch;
      fetch.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve(
                  new Response('%PDF-result', { headers: { 'Content-Type': 'application/pdf' } }),
                ),
              15000,
            ),
          ),
      );
      const pending = apiBlob('/reports/qa/pdf/preview');
      await vi.advanceTimersByTimeAsync(15000);
      expect(await (await pending).text()).toBe('%PDF-result');
      expect(useConnectivity.getState().online).toBe(true);
    },
  );
  it.each(['headers', 'body'])(
    'ends a stalled PDF %s without marking the phone offline',
    async (phase) => {
      vi.useFakeTimers();
      state.expoFetch.mockImplementation(() =>
        phase === 'headers'
          ? new Promise(() => {})
          : Promise.resolve({
              ok: true,
              headers: new Headers({ 'content-type': 'application/pdf' }),
              blob: () => new Promise(() => {}),
            }),
      );
      const check = expect(apiBlob('/reports/qa/pdf')).rejects.toMatchObject({
        code: 'REQUEST_TIMEOUT',
      });
      await vi.advanceTimersByTimeAsync(180000);
      await check;
      expect(useConnectivity.getState().online).toBe(true);
      expect(state.expoFetch.mock.calls[0]![1].signal.aborted).toBe(true);
    },
  );
  it('can cancel even a transport that ignores AbortSignal and retry immediately', async () => {
    const controller = new AbortController();
    state.expoFetch.mockImplementationOnce(() => new Promise(() => {}));
    const check = expect(
      apiBlob('/reports/qa/pdf', { signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'REQUEST_CANCELLED' });
    controller.abort();
    await check;
    expect(useConnectivity.getState().online).toBe(true);
    state.expoFetch.mockResolvedValueOnce(
      new Response('%PDF-retry', { headers: { 'content-type': 'application/pdf' } }),
    );
    expect(await (await apiBlob('/reports/qa/pdf')).text()).toBe('%PDF-retry');
  });
  it('rejects HTML and empty successful responses instead of sharing a broken PDF', async () => {
    state.expoFetch.mockResolvedValueOnce(new Response('<html>proxy</html>'));
    await expect(apiBlob('/reports/qa/pdf')).rejects.toMatchObject({ code: 'INVALID_PDF' });
    state.expoFetch.mockResolvedValueOnce(
      new Response('', { headers: { 'content-type': 'application/pdf' } }),
    );
    await expect(apiBlob('/reports/qa/pdf')).rejects.toMatchObject({ code: 'INVALID_PDF' });
  });
  it('keeps ordinary request timeout compatible with offline fallback', async () => {
    vi.useFakeTimers();
    state.expoFetch.mockImplementationOnce(() => new Promise(() => {}));
    const check = expect(api('/reports/qa')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    await vi.advanceTimersByTimeAsync(12000);
    await check;
    expect(useConnectivity.getState().online).toBe(false);
  });
  it('allows POST generation time beyond 12 seconds as well', async () => {
    vi.useFakeTimers();
    state.expoFetch.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve(result()), 20000)),
    );
    const request = api('/reports/qa/pdf', { method: 'POST' });
    await vi.advanceTimersByTimeAsync(20000);
    expect(await request).toEqual({ id: 'saved' });
  });
});

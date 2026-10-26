import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  platform: { OS: 'ios' },
  expoFetch: vi.fn(),
  nativeFetch: vi.fn(),
}));
vi.mock('react-native', () => ({ Platform: state.platform }));
vi.mock('expo/fetch', () => ({ fetch: state.expoFetch }));
vi.mock('expo-constants', () => ({ default: { expoConfig: null, expoGoConfig: null } }));
vi.mock('../../../app/stores/auth', () => ({
  useAuth: {
    getState: () => ({ session: { accessToken: 'test-access', refreshToken: 'test-refresh' } }),
  },
}));
import { api } from '../../../app/services/api';
const result = () =>
  new Response(JSON.stringify({ success: true, data: { id: 'saved' } }), {
    headers: { 'Content-Type': 'application/json' },
  });
beforeEach(() => {
  state.expoFetch.mockReset().mockResolvedValue(result());
  state.nativeFetch.mockReset().mockResolvedValue(result());
  vi.stubGlobal('fetch', state.nativeFetch);
});
afterEach(() => vi.unstubAllGlobals());
describe('API transport for the installed Expo SDK', () => {
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

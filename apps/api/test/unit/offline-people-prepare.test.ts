import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  hasBlob: vi.fn(),
  permissions: ['people.view'],
}));
vi.mock('../../../app/services/api', () => ({ api: mocks.api, apiUrl: 'https://example.test' }));
vi.mock('../../../app/stores/auth', () => ({
  useAuth: {
    getState: () => ({ session: { user: { id: 'a', permissions: mocks.permissions } } }),
  },
}));
vi.mock('../../../app/stores/connectivity', () => ({
  useConnectivity: { getState: () => ({ online: true }) },
}));
vi.mock('../../../app/services/offline-cache', () => ({ offlineScope: () => 'scope-a' }));
vi.mock('../../../app/services/offline-disk', () => ({
  offlineDisk: { hasBlob: mocks.hasBlob },
  offlineHash: (value: string) => value,
}));
import { prepareOfflineCatalog } from '../../../app/features/reports/offline-prepare';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.permissions = ['people.view'];
  mocks.hasBlob.mockResolvedValue(false);
  mocks.api.mockImplementation(async (path: string) =>
    path.startsWith('/people?')
      ? {
          items: [{ id: path.endsWith('1') ? 'p1' : 'p2', signatureAssetId: 'signature' }],
          pages: 2,
        }
      : { items: [], pages: 0 },
  );
});

it('prepares every page of available people and their signatures in the current account', async () => {
  await prepareOfflineCatalog(vi.fn());
  expect(mocks.api).toHaveBeenCalledWith('/people?active=true&page=2', { accountId: 'a' });
  expect(mocks.api).toHaveBeenCalledWith(
    '/people/signatures/signature',
    { accountId: 'a' },
    true,
    true,
  );
});

it('reuses stored signature files and respects access to the people catalogue', async () => {
  mocks.hasBlob.mockResolvedValue(true);
  await prepareOfflineCatalog(vi.fn());
  expect(mocks.api.mock.calls.some(([path]) => path.startsWith('/people/signatures/'))).toBe(false);
  mocks.api.mockClear();
  mocks.permissions = [];
  await prepareOfflineCatalog(vi.fn());
  expect(mocks.api.mock.calls.some(([path]) => path.startsWith('/people'))).toBe(false);
});

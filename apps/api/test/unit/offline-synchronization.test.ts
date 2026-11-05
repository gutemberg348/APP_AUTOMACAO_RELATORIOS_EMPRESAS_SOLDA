import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  userId: 'a',
  online: true,
  storageError: undefined as string | undefined,
  memory: new Map<string, unknown>(),
  api: vi.fn(),
  catalog: vi.fn(),
  prepare: vi.fn(),
  send: vi.fn(),
}));
vi.mock('../../../app/services/api', () => ({ api: mocks.api, apiUrl: 'https://api.example' }));
vi.mock('../../../app/stores/auth', () => ({
  useAuth: { getState: () => ({ session: { user: { id: mocks.userId } } }) },
}));
vi.mock('../../../app/stores/connectivity', () => ({
  useConnectivity: {
    getState: () => ({ online: mocks.online, storageError: mocks.storageError }),
    setState: (state: { storageError?: string }) => {
      mocks.storageError = state.storageError;
    },
  },
}));
vi.mock('../../../app/services/offline-cache', () => ({
  offlineScope: (_url: string, id: string) => id,
}));
vi.mock('../../../app/services/offline-disk', () => ({
  offlineDisk: {
    get: async (scope: string, key: string) => mocks.memory.get(scope + ':' + key),
    put: async (scope: string, key: string, value: unknown) => {
      mocks.memory.set(scope + ':' + key, value);
    },
    flush: async () => {},
  },
}));
vi.mock('../../../app/features/reports/offline-prepare', () => ({
  prepareOfflineCatalog: mocks.catalog,
  prepareReportOffline: mocks.prepare,
}));
vi.mock('../../../app/features/reports/offline-report-sync', () => ({
  syncWaitingReports: mocks.send,
}));
vi.mock('../../../app/features/reports/offline-report-store', () => ({
  useOfflineReports: { getState: () => ({ drafts: {} }) },
}));
const { synchronizeOffline, useOfflineSynchronization } =
  await import('../../../app/features/reports/offline-synchronization');
beforeEach(() => {
  vi.clearAllMocks();
  mocks.memory.clear();
  mocks.userId = 'a';
  mocks.online = true;
  mocks.storageError = undefined;
  mocks.catalog.mockResolvedValue(undefined);
  mocks.prepare.mockResolvedValue(undefined);
  mocks.send.mockResolvedValue(undefined);
  mocks.api.mockResolvedValue({ items: [{ id: 'r1', version: 1 }], pages: 1 });
  useOfflineSynchronization.setState({
    busy: false,
    message: '',
    error: undefined,
    accountId: undefined,
  });
});
it('one button sends pending changes and prepares all paginated reports, with no duplicate parallel run', async () => {
  mocks.api.mockImplementation(async (path: string) =>
    path.endsWith('page=1')
      ? { items: [{ id: 'r1', version: 1 }], pages: 2 }
      : { items: [{ id: 'r2', version: 2 }], pages: 2 },
  );
  await Promise.all([synchronizeOffline(true), synchronizeOffline(true)]);
  expect(mocks.send).toHaveBeenCalledTimes(1);
  expect(mocks.catalog).toHaveBeenCalledTimes(1);
  expect(mocks.prepare.mock.calls.map((call) => call[0].id)).toEqual(['r1', 'r2']);
  expect(mocks.api).toHaveBeenCalledWith('/reports?limit=100&page=2', { accountId: 'a' });
  expect(useOfflineSynchronization.getState()).toMatchObject({
    busy: false,
    error: undefined,
    message: 'Tudo sincronizado e disponível offline.',
  });
});
it('automatic preparation skips recent successful runs and unchanged versions, manual sync bypasses this', async () => {
  await synchronizeOffline();
  await synchronizeOffline();
  expect(mocks.prepare).toHaveBeenCalledTimes(1);
  mocks.memory.set('a:last-offline-preparation', 1);
  await synchronizeOffline();
  expect(mocks.prepare).toHaveBeenCalledTimes(1);
  await synchronizeOffline(true);
  expect(mocks.prepare).toHaveBeenCalledTimes(2);
});
it('interrupted photo preparation keeps checkpoints for completed reports only and retries after reconnecting', async () => {
  mocks.api.mockResolvedValue({
    items: [
      { id: 'r1', version: 1 },
      { id: 'r2', version: 1 },
    ],
    pages: 1,
  });
  mocks.prepare
    .mockImplementationOnce(async () => {})
    .mockImplementationOnce(async () => {
      mocks.online = false;
      throw new Error('network');
    });
  await synchronizeOffline();
  expect(mocks.memory.get('a:prepared-report-r1')).toBe(1);
  expect(mocks.memory.has('a:prepared-report-r2')).toBe(false);
  expect(mocks.memory.has('a:last-offline-preparation')).toBe(false);
  mocks.online = true;
  await synchronizeOffline();
  expect(mocks.prepare.mock.calls.map((call) => call[0].id)).toEqual(['r1', 'r2', 'r2']);
});
it('does not continue an old account job after switching accounts', async () => {
  mocks.catalog.mockImplementationOnce(async () => {
    mocks.userId = 'b';
  });
  await synchronizeOffline(true);
  expect(mocks.api).not.toHaveBeenCalled();
  expect(mocks.memory.has('b:last-offline-preparation')).toBe(false);
});
it('retries a previous storage error and reports success only if saving succeeds', async () => {
  mocks.storageError = 'old failure';
  mocks.prepare.mockImplementationOnce(async () => {
    mocks.storageError = 'Disk full';
  });
  await synchronizeOffline(true);
  expect(useOfflineSynchronization.getState().error).toBe('Disk full');
  expect(mocks.memory.has('a:last-offline-preparation')).toBe(false);
  await synchronizeOffline(true);
  expect(useOfflineSynchronization.getState().error).toBeUndefined();
});

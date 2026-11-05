import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  memory: new Map<string, unknown>(),
  api: vi.fn(),
}));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'local-signature' }));
vi.mock('../../../app/services/api', () => ({
  api: mocks.api,
  jsonBody: (method: string, data: unknown) => ({ method, body: JSON.stringify(data) }),
}));
vi.mock('../../../app/stores/auth', () => ({
  useAuth: { getState: () => ({ session: { user: { id: 'user-a' } } }) },
}));
vi.mock('../../../app/services/offline-files', () => ({
  currentOfflineScope: () => 'account-a',
  keepReportAsset: async (asset: unknown) => asset,
  restoreReportAsset: async (_scope: string, asset: unknown) => asset,
}));
vi.mock('../../../app/services/upload-file', () => ({ appendUploadFile: vi.fn() }));
vi.mock('../../../app/services/offline-disk', () => ({
  offlineDisk: {
    put: async (scope: string, key: string, value: unknown) => {
      mocks.memory.set(scope + ':' + key, structuredClone(value));
    },
    get: async (scope: string, key: string) => structuredClone(mocks.memory.get(scope + ':' + key)),
  },
}));
import { useConnectivity } from '../../../app/stores/connectivity';
import {
  localSignature,
  saveLocalSignature,
  syncLocalSignatures,
} from '../../../app/features/people/offline-signatures';
const strokes = [
  [
    { x: 0.1, y: 0.2 },
    { x: 0.3, y: 0.4 },
  ],
];
beforeEach(() => {
  mocks.memory.clear();
  mocks.api.mockReset();
  useConnectivity.setState({ online: false });
});
it('retains handwritten signatures offline and uploads once when resolving report signers', async () => {
  const local = await saveLocalSignature({ strokes });
  expect(mocks.api).not.toHaveBeenCalled();
  expect((await localSignature(local.id))?.strokes).toEqual(strokes);
  useConnectivity.setState({ online: true });
  mocks.api.mockResolvedValue({ id: 'remote-signature' });
  const signers = [{ role: 'INSPECTOR', name: 'TESTE', signatureAssetId: local.id }];
  const resolved = await syncLocalSignatures(signers);
  expect(resolved[0].signatureAssetId).toBe('remote-signature');
  expect(mocks.api.mock.calls[0][1].accountId).toBe('user-a');
  expect(await syncLocalSignatures(signers)).toEqual(resolved);
  expect(mocks.api).toHaveBeenCalledTimes(1);
});
it('retains the local signature if connectivity fails during an attempted upload', async () => {
  useConnectivity.setState({ online: true });
  mocks.api.mockRejectedValue(Object.assign(new Error('offline'), { code: 'NETWORK_ERROR' }));
  const result = await saveLocalSignature({ strokes });
  expect(result.id).toBe('local-signature');
  expect((await localSignature(result.id))?.strokes).toEqual(strokes);
});

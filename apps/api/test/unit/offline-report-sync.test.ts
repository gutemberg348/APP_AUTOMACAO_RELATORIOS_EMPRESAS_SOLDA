import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { reportTypeCodes, type Report } from '@weldcosta/shared';
const mocks = vi.hoisted(() => ({
  memory: new Map<string, unknown>(),
  api: vi.fn(),
  removeBlob: vi.fn(),
  user: {
    id: 'user-a',
    role: { code: 'ADMIN' },
    permissions: ['reports.edit.allFields', 'drawing.edit'],
  },
}));
vi.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000099' }));
vi.mock('../../../app/services/api', () => ({
  api: mocks.api,
  jsonBody: (method: string, data: unknown) => ({ method, body: JSON.stringify(data) }),
  ApiError: class extends Error {
    constructor(
      public status: number,
      public code: string,
      message: string,
    ) {
      super(message);
    }
  },
}));
vi.mock('../../../app/stores/auth', () => ({
  useAuth: { getState: () => ({ session: { user: mocks.user } }) },
}));
vi.mock('../../../app/services/offline-files', () => ({
  restoreReportAsset: async (_scope: string, asset: unknown) => asset,
}));
vi.mock('../../../app/services/upload-file', () => ({
  appendUploadFile: async (form: FormData) => form.append('file', new Blob(['photo']), 'foto.jpg'),
}));
vi.mock('../../../app/features/people/offline-signatures', () => ({
  syncLocalSignatures: async (signers: unknown) => signers,
}));
vi.mock('../../../app/services/offline-disk', () => ({
  offlineHash: (key: string) => key.replace(/[^a-z0-9]/gi, '-'),
  offlineDisk: {
    put: async (scope: string, key: string, value: unknown) => {
      mocks.memory.set(scope + ':' + key, structuredClone(value));
    },
    get: async (scope: string, key: string) => structuredClone(mocks.memory.get(scope + ':' + key)),
    remove: async (scope: string, key: string) => {
      mocks.memory.delete(scope + ':' + key);
    },
    keys: async (scope: string, prefix: string) =>
      [...mocks.memory.keys()]
        .filter((key) => key.startsWith(scope + ':' + prefix))
        .map((key) => key.slice(scope.length + 1)),
    flush: async () => {},
    removeBlob: mocks.removeBlob,
    getBlob: async () => undefined,
  },
}));
import { ApiError } from '../../../app/services/api';
import { useConnectivity } from '../../../app/stores/connectivity';
import {
  activeOfflineReports,
  flushPhotoQueue,
  hydrateOfflineReports,
  persistPhotoQueue,
  putLocalReport,
  useOfflineReports,
  type LocalReportDraft,
} from '../../../app/features/reports/offline-report-store';
import { useReportPhotoDrafts } from '../../../app/features/reports/report-photo-drafts';
import {
  syncLocalReport,
  syncWaitingReports,
} from '../../../app/features/reports/offline-report-sync';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const initial = () =>
  ({
    id: id(1),
    userId: 'user-a',
    companyId: id(2),
    projectId: id(3),
    type: { id: id(4), code: 'EVD', name: 'Direto', config: {}, description: null, active: true },
    photoKey: 'user-a:local-' + id(1),
    values: {
      number: 'OFFLINE-1',
      title: 'LOCAL TITLE',
      reportDate: '',
      specificData: {},
      points: [{ clientId: 'local-point', number: '1', type: 'WELD' }],
      signatures: [],
      drawings: [],
    },
    mutationId: id(5),
    updatedAt: '2026-11-04',
    files: ['photo-a.jpg', 'photo-b.jpg'],
  }) as LocalReportDraft;
let unsubscribe: (() => void) | undefined;
beforeEach(async () => {
  mocks.memory.clear();
  mocks.api.mockReset();
  mocks.removeBlob.mockReset().mockResolvedValue(undefined);
  activeOfflineReports.clear();
  useReportPhotoDrafts.setState({ reports: {} });
  useConnectivity.setState({ online: true });
  await hydrateOfflineReports('qa', 'user-a');
  unsubscribe = persistPhotoQueue('qa', 'user-a');
});
afterEach(async () => {
  await flushPhotoQueue();
  unsubscribe?.();
});
it.each(reportTypeCodes)(
  'retains the remaining photo and server point IDs after interrupted upload, then resumes after restart in %s',
  async (code) => {
    const entry = initial();
    entry.type = { ...entry.type, code };
    entry.values.points[0]!.type = code === 'ME' ? 'MEASUREMENT' : 'WELD';
    await putLocalReport(entry);
    useReportPhotoDrafts.getState().update(entry.photoKey, () => ({
      photos: ['a', 'b'].map((name) => ({
        id: name,
        pointKey: 'local-point',
        caption: '',
        asset: {
          name: name + '.jpg',
          uri: 'doc://' + name,
          offlineFileId: 'photo-' + name + '.jpg',
        },
      })),
      removedIds: [],
    }));
    await flushPhotoQueue();
    let saved: Report | undefined,
      interrupted = true,
      creations = 0;
    mocks.api.mockImplementation(async (path, init) => {
      if (path === '/reports') {
        creations++;
        saved = {
          ...entry.values,
          id: id(10),
          version: 1,
          projectId: entry.projectId,
          companyId: entry.companyId,
          company: { name: 'QA' },
          project: { name: 'Work' },
          reportType: entry.type,
          lastClientMutationId: entry.mutationId,
          points: [{ id: id(11), number: '1', type: 'WELD' }],
          media: [],
        } as unknown as Report;
        return structuredClone(saved);
      }
      if (path.endsWith('/media')) {
        const form = init.body as FormData,
          photo = String(form.get('clientUploadId'));
        if (photo === 'b' && interrupted) {
          useConnectivity.setState({ online: false });
          throw new ApiError(0, 'NETWORK_ERROR', 'Conexão interrompida');
        }
        saved!.media!.push({
          id: id(photo === 'a' ? 20 : 21),
          reportPointId: String(form.get('reportPointId')),
          clientUploadId: photo,
          caption: '',
          mimeType: 'image/jpeg',
          originalName: photo + '.jpg',
          sectionKey: 'photos',
        });
        saved!.version++;
        return {};
      }
      return structuredClone(saved);
    });
    await expect(syncLocalReport(entry.id)).rejects.toThrow('pendentes');
    expect(mocks.removeBlob).not.toHaveBeenCalled();
    expect(useOfflineReports.getState().drafts[entry.id]?.baseReport?.version).toBe(2);
    expect(
      useReportPhotoDrafts
        .getState()
        .reports['user-a:' + id(10)]?.photos.map((p) => [p.id, p.pointKey]),
    ).toEqual([['b', id(11)]]);
    unsubscribe?.();
    unsubscribe = undefined;
    useOfflineReports.setState({ drafts: {} });
    useReportPhotoDrafts.setState({ reports: {} });
    await hydrateOfflineReports('qa', 'user-a');
    unsubscribe = persistPhotoQueue('qa', 'user-a');
    interrupted = false;
    useConnectivity.setState({ online: true });
    const result = await syncLocalReport(entry.id);
    expect(creations).toBe(1);
    expect(result.media).toHaveLength(2);
    expect(result.media?.every((p) => p.reportPointId === id(11))).toBe(true);
    expect(useOfflineReports.getState().drafts[entry.id]).toBeUndefined();
    expect(mocks.removeBlob).toHaveBeenCalledTimes(2);
  },
);
it.each(reportTypeCodes)(
  'keeps local fields and photos on server conflict and does not retry an active form automatically in %s',
  async (code) => {
    const entry = initial();
    entry.type = { ...entry.type, code };
    entry.baseReport = { id: id(10), version: 1 } as Report;
    await putLocalReport(entry);
    activeOfflineReports.add(entry.id);
    await syncWaitingReports();
    expect(mocks.api).not.toHaveBeenCalled();
    activeOfflineReports.delete(entry.id);
    mocks.api.mockRejectedValue(
      new ApiError(409, 'VERSION_CONFLICT', 'Alterado em outro aparelho'),
    );
    await expect(syncLocalReport(entry.id)).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    expect(useOfflineReports.getState().drafts[entry.id]?.values.title).toBe('LOCAL TITLE');
    expect(useOfflineReports.getState().drafts[entry.id]?.error?.code).toBe('VERSION_CONFLICT');
    expect(mocks.removeBlob).not.toHaveBeenCalled();
  },
);
it.each(reportTypeCodes)(
  'allows incomplete local drafts but reports the missing field when synchronization is requested in %s',
  async (code) => {
    const entry = initial();
    entry.type = { ...entry.type, code };
    entry.values.number = '';
    await putLocalReport(entry);
    await expect(syncLocalReport(entry.id)).rejects.toThrow();
    expect(mocks.api).not.toHaveBeenCalled();
    expect(useOfflineReports.getState().drafts[entry.id]?.error).toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(useOfflineReports.getState().drafts[entry.id]?.error?.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: ['number'] })]),
    );
  },
);

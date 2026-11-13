import { newDrawingData, reportTypeCodes } from '@weldcosta/shared';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const memory = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../../../app/services/offline-disk', () => ({
  offlineHash: (key: string) => key.replace(/[^a-z0-9]/gi, '-'),
  offlineDisk: {
    put: vi.fn(async (scope: string, key: string, value: unknown) => {
      memory.set(scope + ':' + key, structuredClone(value));
    }),
    get: vi.fn(async (scope: string, key: string) =>
      structuredClone(memory.get(scope + ':' + key)),
    ),
    remove: vi.fn(async (scope: string, key: string) => {
      memory.delete(scope + ':' + key);
    }),
    keys: vi.fn(async (scope: string, prefix: string) =>
      [...memory.keys()]
        .filter((k) => k.startsWith(scope + ':' + prefix))
        .map((k) => k.slice(scope.length + 1)),
    ),
    flush: vi.fn(async () => {}),
  },
}));
vi.mock('../../../app/services/offline-files', () => ({
  restoreReportAsset: vi.fn(async (_scope, asset) => ({
    ...asset,
    uri: 'restored://' + asset.offlineFileId,
  })),
}));
vi.mock('../../../app/services/api', () => ({ api: vi.fn(), jsonBody: vi.fn() }));
vi.mock('../../../app/services/upload-file', () => ({ appendUploadFile: vi.fn() }));
import {
  hydrateOfflineReports,
  persistPhotoQueue,
  flushPhotoQueue,
  putLocalReport,
  useOfflineReports,
  type LocalReportDraft,
  offlineValuesFingerprint,
} from '../../../app/features/reports/offline-report-store';
import {
  remapReportPhotos,
  useReportPhotoDrafts,
} from '../../../app/features/reports/report-photo-drafts';
import { offlineDisk } from '../../../app/services/offline-disk';
import type { Report } from '@weldcosta/shared';
let stop: (() => void) | undefined;
beforeEach(async () => {
  memory.clear();
  useReportPhotoDrafts.setState({ reports: {} });
  await hydrateOfflineReports('scope-a', 'user-a');
  stop = persistPhotoQueue('scope-a', 'user-a');
});
afterEach(async () => {
  await flushPhotoQueue();
  stop?.();
});
const draft = () =>
  ({
    id: 'draft-a',
    userId: 'user-a',
    companyId: 'company',
    projectId: 'work',
    type: { id: 'type', code: 'EVD', name: 'Direto', config: {} },
    photoKey: 'user-a:local-draft-a',
    values: {
      number: '001',
      title: 'OFFLINE',
      reportDate: '',
      specificData: {},
      points: [{ clientId: 'p-local', number: '1', type: 'WELD' }],
      drawings: [],
      signatures: [],
    },
    updatedAt: '2026-11-04',
    mutationId: 'mutation',
    files: ['photo-a.jpg'],
  }) as LocalReportDraft;
it('keeps the retry identity when only optional field defaults or object key order change', () => {
  const original = draft().values;
  const defaults = { ...original, specificData: { extra: '', client: '' } };
  expect(offlineValuesFingerprint(defaults)).toBe(offlineValuesFingerprint(original));
  expect(offlineValuesFingerprint({ ...original, title: 'CHANGED' })).not.toBe(
    offlineValuesFingerprint(original),
  );
});
it.each(reportTypeCodes)(
  'restores form fields, drawings, photo bytes references, captions and annotations after restart in %s',
  async (code) => {
    const input = draft();
    input.type = { ...input.type, code };
    input.values.drawings = [
      {
        data: {
          ...newDrawingData(),
          notes: 'SOMENTE NO APP',
          elements: [
            {
              id: 'line',
              type: 'line',
              x1: 100,
              y1: 200,
              x2: 600,
              y2: 500,
              strokeColor: '#DC2626',
              strokeWidth: 3,
            },
            {
              id: 'number',
              type: 'point',
              reportPointId: 'p-local',
              x: 250,
              y: 290,
              labelPosition: 'custom',
              labelX: 250,
              labelY: 260,
            },
          ],
        },
      },
    ];
    await putLocalReport(input);
    useReportPhotoDrafts.getState().update(input.photoKey, () => ({
      projectId: 'work',
      photos: [
        {
          id: 'photo',
          pointKey: 'p-local',
          caption: 'LEGENDA',
          annotations: {
            measurementDetails: {
              side: 'LATERAL',
              discontinuity: '-',
              acceptable: false,
              projectThickness: '6 mm',
            },
            elements: [
              { id: 'paint', type: 'line', x1: 10, y1: 20, x2: 40, y2: 60, strokeColor: '#1764C0' },
            ],
            measurements: [{ id: 'reading', number: '1', x: 0.4, y: 0.5, value: 5.9 }],
          },
          asset: { uri: 'cache://temporary', name: 'foto.jpg', offlineFileId: 'photo-a.jpg' },
        },
      ],
      removedIds: ['removed'],
      captionEdits: { old: 'NOVA' },
    }));
    await flushPhotoQueue();
    stop?.();
    stop = undefined;
    useReportPhotoDrafts.setState({ reports: {} });
    useOfflineReports.setState({ drafts: {} });
    await hydrateOfflineReports('scope-a', 'user-a');
    expect(useOfflineReports.getState().drafts['draft-a']?.values).toEqual(input.values);
    const photos = useReportPhotoDrafts.getState().reports[input.photoKey]!;
    expect(photos.photos[0]?.asset.uri).toBe('restored://photo-a.jpg');
    expect(photos.photos[0]?.pointKey).toBe('p-local');
    expect(photos.photos[0]?.caption).toBe('LEGENDA');
    expect(photos.photos[0]?.annotations).toMatchObject({
      measurementDetails: { side: 'LATERAL', acceptable: false, projectThickness: '6 mm' },
      elements: [{ id: 'paint', strokeColor: '#1764C0' }],
      measurements: [{ number: '1', value: 5.9 }],
    });
    expect(photos.removedIds).toEqual(['removed']);
    expect(photos.captionEdits).toEqual({ old: 'NOVA' });
  },
);
it('persists the remapped destination before removing the old queue and makes replay harmless', async () => {
  const key = draft().photoKey;
  useReportPhotoDrafts.getState().update(key, () => ({
    photos: [
      {
        id: 'photo',
        pointKey: 'p-local',
        caption: '',
        asset: { uri: 'doc://photo', name: 'foto.jpg' },
      },
    ],
    removedIds: [],
  }));
  await flushPhotoQueue();
  vi.mocked(offlineDisk.put).mockClear();
  vi.mocked(offlineDisk.remove).mockClear();
  const saved = {
    id: 'remote',
    projectId: 'work',
    points: [{ id: 'p-server', number: '1' }],
  } as Report;
  const next = remapReportPhotos(key, saved, draft().values.points);
  await flushPhotoQueue();
  expect(useReportPhotoDrafts.getState().reports[next]?.photos[0]?.pointKey).toBe('p-server');
  expect(vi.mocked(offlineDisk.put).mock.invocationCallOrder[0]).toBeLessThan(
    vi.mocked(offlineDisk.remove).mock.invocationCallOrder[0]!,
  );
  remapReportPhotos(key, saved, draft().values.points);
  expect(useReportPhotoDrafts.getState().reports[next]?.photos).toHaveLength(1);
});
it('isolates accounts and refuses an old account write after account switching', async () => {
  await putLocalReport(draft());
  stop?.();
  stop = undefined;
  await hydrateOfflineReports('scope-b', 'user-b');
  expect(useOfflineReports.getState().drafts).toEqual({});
  expect(useReportPhotoDrafts.getState().reports).toEqual({});
  await expect(putLocalReport(draft())).rejects.toThrow('conta');
  await hydrateOfflineReports('scope-a', 'user-a');
  expect(useOfflineReports.getState().drafts['draft-a']?.values.number).toBe('001');
});

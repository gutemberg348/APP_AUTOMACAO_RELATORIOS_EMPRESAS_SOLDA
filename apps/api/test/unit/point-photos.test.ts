import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reportTypeCodes, type Report, type ReportPoint } from '@weldcosta/shared';
import { api, ApiError } from '../../../app/services/api';
import {
  ReportPhotoSaveError,
  photoSaveReason,
} from '../../../app/features/reports/report-photo-error';
import {
  saveReportPhotos,
  useReportPhotoDrafts,
} from '../../../app/features/reports/report-photo-drafts';

vi.mock('../../../app/services/api', () => ({
  api: vi.fn(),
  ApiError: class extends Error {
    constructor(
      public status: number,
      public code: string,
      message: string,
    ) {
      super(message);
    }
  },
  jsonBody: (method: string, body: unknown) => ({ method, body: JSON.stringify(body) }),
}));
vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));
vi.mock('expo-file-system', () => ({ File: vi.fn() }));
const apiMock = vi.mocked(api);
const points: ReportPoint[] = [{ clientId: 'local-point', number: 'S-42', type: 'WELD', data: {} }];
const saved = {
  id: 'report-1',
  version: 1,
  points: [{ id: 'persisted-point', number: 'S-42', type: 'WELD' }],
} as Report;
const draft = (id: string) => ({
  id,
  pointKey: 'local-point',
  caption: 'Solda',
  asset: {
    uri: 'blob:photo',
    name: 'foto.jpg',
    lastModified: 1,
    file: new File(['photo'], 'foto.jpg', { type: 'image/jpeg' }),
  },
});

beforeEach(() => {
  apiMock.mockReset();
  useReportPhotoDrafts.setState({ reports: {} });
});
describe('Photos selected in the point form', () => {
  it('explains the rejected photo field instead of only repeating the generic API message', () => {
    const reason = photoSaveReason({
      code: 'VALIDATION_ERROR',
      message: 'Confira os campos informados.',
      details: [{ path: ['annotations', 'elements'], message: 'Há marcações demais nesta foto.' }],
    });
    expect(reason).toBe('Marcações da foto: Há marcações demais nesta foto.');
  });
  it('retains the exact point/photo and duplicate reason so Correct can explain the project rule', async () => {
    useReportPhotoDrafts
      .getState()
      .update('user:new', () => ({ photos: [draft('pending')], removedIds: [] }));
    apiMock
      .mockRejectedValueOnce(new ApiError(409, 'DUPLICATE_MEDIA', 'Foto repetida nesta obra.'))
      .mockResolvedValueOnce(saved);
    await saveReportPhotos('user:new', saved, points);
    const remaining = useReportPhotoDrafts.getState().reports['user:report-1']!;
    expect(remaining.photos).toHaveLength(1);
    expect(remaining.error).toBeInstanceOf(ReportPhotoSaveError);
    expect(remaining.error).toMatchObject({
      code: 'DUPLICATE_MEDIA',
      location: { pointNumber: 'S-42', label: expect.stringContaining('foto.jpg') },
    });
  });
  it('includes pending paint in the same original photo upload', async () => {
    const annotations = {
      elements: [
        {
          id: 'ink',
          type: 'line' as const,
          x1: 100,
          y1: 100,
          x2: 200,
          y2: 100,
          brush: 'marker' as const,
          strokeWidth: 18,
        },
      ],
    };
    useReportPhotoDrafts.getState().update('user:new', () => ({
      photos: [{ ...draft('painted'), annotations }],
      removedIds: [],
    }));
    apiMock
      .mockResolvedValueOnce({ id: 'painted' })
      .mockResolvedValueOnce({ ...saved, version: 2 });
    await saveReportPhotos('user:new', saved, points);
    const body = apiMock.mock.calls[0]?.[1]?.body as FormData;
    expect(JSON.parse(body.get('annotations') as string)).toEqual(annotations);
    expect(body.get('reportPointId')).toBe('persisted-point');
    expect((body.get('file') as File).name).toBe('foto.jpg');
  });
  it('saves photo marks without reuploading or reassigning the original and keeps failed marks retryable', async () => {
    const annotations = {
      elements: [
        { id: 'ink', type: 'line', x1: 100, y1: 100, x2: 200, y2: 100, strokeColor: '#DC2626' },
      ],
    };
    const photo = {
      id: 'photo',
      caption: 'Original',
      sectionKey: 'photos',
      reportPointId: 'persisted-point',
    };
    const report = { ...saved, media: [photo] } as Report;
    useReportPhotoDrafts.getState().update('user:report-1', () => ({
      photos: [],
      removedIds: [],
      annotationEdits: { photo: annotations as never },
    }));
    apiMock.mockRejectedValueOnce(new Error('Sem conexão')).mockResolvedValueOnce(report);
    await saveReportPhotos('user:report-1', report, points);
    expect(
      useReportPhotoDrafts.getState().reports['user:report-1']?.annotationEdits?.photo,
    ).toEqual(annotations);
    apiMock
      .mockReset()
      .mockResolvedValueOnce({ id: 'photo' })
      .mockResolvedValueOnce({ ...report, version: 2 });
    await saveReportPhotos('user:report-1', report, points);
    expect(apiMock.mock.calls[0]?.[0]).toBe('/reports/report-1/media/photo');
    expect(JSON.parse(apiMock.mock.calls[0]?.[1]?.body as string)).toMatchObject({
      caption: 'Original',
      reportPointId: 'persisted-point',
      annotations,
    });
    expect(useReportPhotoDrafts.getState().reports['user:report-1']?.annotationEdits).toEqual({});
    expect(apiMock.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
  });
  it('does not ask to resend a completed image when only refreshing the report fails', async () => {
    useReportPhotoDrafts.getState().update('user:new', () => ({
      photos: [{ ...draft('general'), pointKey: null }],
      removedIds: [],
    }));
    apiMock
      .mockResolvedValueOnce({ id: 'general' })
      .mockRejectedValueOnce(new Error('Sem conexão'))
      .mockRejectedValueOnce(new Error('Sem conexão'));
    await saveReportPhotos('user:new', saved, []);
    const remaining = useReportPhotoDrafts.getState().reports['user:report-1']!;
    expect(remaining.photos).toEqual([]);
    expect((remaining.error as Error).message).toContain('atualizar a visualização');
    expect((remaining.error as Error).message).not.toContain('pendentes');
    expect(apiMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
  });
  it('saves an optional general photo without creating or assigning a weld point', async () => {
    useReportPhotoDrafts.getState().update('user:new', () => ({
      photos: [{ ...draft('general'), pointKey: null }],
      removedIds: [],
    }));
    apiMock
      .mockResolvedValueOnce({ id: 'general' })
      .mockResolvedValueOnce({ ...saved, version: 2 });
    await saveReportPhotos('user:new', saved, []);
    const body = apiMock.mock.calls[0]![1]!.body as FormData;
    expect(body.get('reportPointId')).toBeNull();
    expect(body.get('sectionKey')).toBe('photos');
    expect(useReportPhotoDrafts.getState().reports['user:report-1']?.photos).toEqual([]);
  });
  it('updates captions inside their own cards without changing point or croqui associations', async () => {
    const photo = {
      id: 'weld-photo',
      reportPointId: 'persisted-point',
      sectionKey: 'photos',
      caption: 'Original',
    };
    const croqui = { ...photo, id: 'old-croqui', sectionKey: 'drawing', reportPointId: null };
    const report = { ...saved, media: [photo, croqui] } as Report;
    useReportPhotoDrafts.getState().update('user:report-1', () => ({
      photos: [],
      removedIds: [],
      captionEdits: { 'weld-photo': 'Solda conferida', 'old-croqui': 'Referência' },
    }));
    apiMock
      .mockResolvedValueOnce({ id: photo.id })
      .mockResolvedValueOnce({ ...report, version: 2 })
      .mockResolvedValueOnce({ id: croqui.id })
      .mockResolvedValueOnce({ ...report, version: 3 });
    await saveReportPhotos('user:report-1', report, report.points!);
    const patches = apiMock.mock.calls
      .filter(([, options]) => options?.method === 'PATCH')
      .map(([, options]) => JSON.parse(options!.body as string));
    expect(patches[0]).toMatchObject({
      version: 1,
      caption: 'Solda conferida',
      reportPointId: 'persisted-point',
      sectionKey: 'photos',
    });
    expect(patches[1]).toMatchObject({
      version: 2,
      caption: 'Referência',
      reportPointId: null,
      sectionKey: 'drawing',
    });
    expect(useReportPhotoDrafts.getState().reports['user:report-1']?.captionEdits).toEqual({});
  });
  it('resolves local point IDs after renumbering and advances the version for each image', async () => {
    useReportPhotoDrafts
      .getState()
      .update('user:new', () => ({ photos: [draft('a'), draft('b')], removedIds: [] }));
    apiMock
      .mockResolvedValueOnce({ id: 'a' })
      .mockResolvedValueOnce({ ...saved, version: 2 })
      .mockResolvedValueOnce({ id: 'b' })
      .mockResolvedValueOnce({ ...saved, version: 3 });
    const onProgress = vi.fn();
    const report = await saveReportPhotos('user:new', saved, points, onProgress);
    expect(report.version).toBe(3);
    const calls = apiMock.mock.calls.filter(([, options]) => options?.method === 'POST');
    expect((calls[0]![1]!.body as FormData).get('reportPointId')).toBe('persisted-point');
    expect((calls[1]![1]!.body as FormData).get('version')).toBe('2');
    expect(useReportPhotoDrafts.getState().reports['user:report-1']?.photos).toEqual([]);
    const uploads = onProgress.mock.calls
      .map(([progress]) => progress)
      .filter((progress) => progress.message.startsWith('Enviando foto'));
    expect(uploads.map((progress) => [progress.completed, progress.total])).toEqual([
      [0, 2],
      [1, 2],
    ]);
    expect(uploads[0].detail).toContain('S-42');
    expect(onProgress.mock.calls.at(-1)?.[0]).toMatchObject({ completed: 2, total: 2 });
  });
  it('retains only failed photos across the create/edit route and retries without resending completed images', async () => {
    useReportPhotoDrafts
      .getState()
      .update('user:new', () => ({ photos: [draft('a'), draft('b')], removedIds: [] }));
    apiMock
      .mockResolvedValueOnce({ id: 'a' })
      .mockResolvedValueOnce({ ...saved, version: 2 })
      .mockRejectedValueOnce(new Error('Sem conexão'))
      .mockResolvedValueOnce({ ...saved, version: 2 });
    await saveReportPhotos('user:new', saved, points);
    const pending = useReportPhotoDrafts.getState().reports['user:report-1']!;
    expect(pending.photos.map((item) => item.id)).toEqual(['b']);
    expect(pending.photos[0]?.pointKey).toBe('persisted-point');
    expect(pending.error).toBeInstanceOf(Error);
    expect(pending.error).toBeInstanceOf(ReportPhotoSaveError);
    expect((pending.error as ReportPhotoSaveError).location.pointNumber).toBe('S-42');
    expect((pending.error as Error).message).toContain('foto.jpg');
    expect((pending.error as Error).message).toContain('Sem conexão');
    apiMock.mockReset();
    apiMock.mockResolvedValueOnce({ id: 'b' }).mockResolvedValueOnce({ ...saved, version: 4 });
    await saveReportPhotos('user:report-1', { ...saved, version: 3 }, saved.points!);
    expect(apiMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
    expect(useReportPhotoDrafts.getState().reports['user:report-1']?.photos).toEqual([]);
  });
});

it.each(reportTypeCodes)(
  'resumes photo deletion after losing the server acknowledgement in %s',
  async (code) => {
    const photo = {
      id: 'removed-photo',
      reportPointId: 'persisted-point',
      sectionKey: 'photos',
      originalName: 'remover.jpg',
    };
    const report = { ...saved, reportType: { code }, media: [photo] } as Report;
    const afterDelete = { ...report, version: 2, media: [] };
    useReportPhotoDrafts.getState().update('user:report-1', () => ({
      photos: [],
      removedIds: [photo.id],
    }));
    // The server committed DELETE, but neither its response nor the refresh arrived.
    apiMock.mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'Sem conexão'));
    await saveReportPhotos('user:report-1', report, report.points!);
    expect(useReportPhotoDrafts.getState().reports['user:report-1']?.removedIds).toEqual([
      photo.id,
    ]);
    // Reconnection/save returned the current authoritative report without that photo.
    apiMock.mockReset().mockImplementation(async (_path, options) => {
      if (options?.method === 'DELETE') throw new ApiError(404, 'NOT_FOUND', 'Foto já removida');
      return afterDelete;
    });
    await saveReportPhotos('user:report-1', afterDelete, report.points!);
    expect(useReportPhotoDrafts.getState().reports['user:report-1']?.removedIds).toEqual([]);
    expect(useReportPhotoDrafts.getState().reports['user:report-1']?.error).toBeUndefined();
    expect(apiMock.mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(false);
  },
);

// Regression from the tablet recording: the report route/key stays identical
// when a new local point receives its server ID during an edit.
it.each(reportTypeCodes)(
  'uploads a new point on an existing %s report and retries without duplicating completed photos',
  async (code) => {
    const report = { ...saved, reportType: { code } } as Report;
    useReportPhotoDrafts
      .getState()
      .update('user:report-1', () => ({ photos: [draft('a'), draft('b')], removedIds: [] }));
    apiMock
      .mockResolvedValueOnce({ id: 'a' })
      .mockResolvedValueOnce({ ...report, version: 2 })
      .mockRejectedValueOnce(new ApiError(503, 'SERVER_BUSY', 'Tente novamente.'))
      .mockResolvedValueOnce({ ...report, version: 2 });
    await saveReportPhotos('user:report-1', report, points);
    const remaining = useReportPhotoDrafts.getState().reports['user:report-1']!;
    expect(remaining.photos.map((p) => [p.id, p.pointKey])).toEqual([['b', 'persisted-point']]);
    expect((apiMock.mock.calls[0]![1]!.body as FormData).get('reportPointId')).toBe(
      'persisted-point',
    );
    apiMock
      .mockReset()
      .mockResolvedValueOnce({ id: 'b' })
      .mockResolvedValueOnce({ ...report, version: 3 });
    await saveReportPhotos('user:report-1', { ...report, version: 2 }, report.points!);
    expect(apiMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
    expect(useReportPhotoDrafts.getState().reports['user:report-1']?.photos).toEqual([]);
  },
);

it('recovers a restored local point using its saved number when its client ID is no longer in the form', async () => {
  useReportPhotoDrafts
    .getState()
    .update('user:report-1', () => ({
      photos: [{ ...draft('restored'), pointNumber: 'S-42' }],
      removedIds: [],
    }));
  apiMock.mockResolvedValueOnce({ id: 'restored' }).mockResolvedValueOnce(saved);
  await saveReportPhotos('user:report-1', saved, saved.points!);
  expect((apiMock.mock.calls[0]![1]!.body as FormData).get('reportPointId')).toBe(
    'persisted-point',
  );
  expect(useReportPhotoDrafts.getState().reports['user:report-1']?.photos).toEqual([]);
});

it('preserves an unknown orphan photo and provides a located, actionable error rather than a generic failure', async () => {
  useReportPhotoDrafts
    .getState()
    .update('user:report-1', () => ({ photos: [draft('orphan')], removedIds: [] }));
  apiMock.mockResolvedValue(saved);
  await saveReportPhotos('user:report-1', saved, saved.points!);
  const remaining = useReportPhotoDrafts.getState().reports['user:report-1']!;
  expect(remaining.photos).toHaveLength(1);
  expect(remaining.error).toMatchObject({
    code: 'PHOTO_POINT_PENDING',
    location: { photoId: 'orphan' },
  });
  expect((remaining.error as Error).message).toContain('Fotos aguardando vínculo');
  expect(apiMock.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
});

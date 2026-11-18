import { beforeEach, expect, it, vi } from 'vitest';
import { api, ApiError } from '../../../app/services/api';
import { checkReportPhoto } from '../../../app/features/reports/check-report-photo';
import { useReportPhotoDrafts } from '../../../app/features/reports/report-photo-drafts';
import { useConnectivity } from '../../../app/stores/connectivity';
import { localPhotoHash } from '../../../app/services/offline-files';

vi.mock('../../../app/services/api', () => ({
  api: vi.fn(),
  jsonBody: vi.fn(),
  ApiError: class extends Error {
    constructor(
      public status: number,
      public code: string,
      message: string,
      public details?: unknown,
    ) {
      super(message);
    }
  },
}));
vi.mock('../../../app/services/offline-files', () => ({
  localPhotoHash: vi.fn().mockResolvedValue('offline-sha256'),
}));
vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));
vi.mock('expo-file-system', () => ({ File: vi.fn() }));
const asset = {
  name: 'renamed.jpg',
  uri: 'blob:photo',
  file: new File(['photo'], 'renamed.jpg'),
  lastModified: 0,
};
beforeEach(() => {
  vi.mocked(api).mockReset();
  useConnectivity.setState({ online: true });
  useReportPhotoDrafts.setState({ reports: {} });
});
it('accepts photos without internet and still detects local reuse in another point', async () => {
  useConnectivity.setState({ online: false });
  await expect(checkReportPhoto(asset, 'user:new', { projectId: 'work-a' })).resolves.toEqual({
    sha256: 'offline-sha256',
    duplicate: false,
  });
  expect(api).not.toHaveBeenCalled();
  expect(localPhotoHash).toHaveBeenCalledWith(asset);
  useReportPhotoDrafts.getState().update('user:new', () => ({
    projectId: 'work-a',
    photos: [{ id: 'photo', pointKey: 'a', asset, caption: '', sha256: 'offline-sha256' }],
    removedIds: [],
  }));
  await expect(checkReportPhoto(asset, 'user:new', { projectId: 'work-a' })).resolves.toEqual({
    sha256: 'offline-sha256',
    duplicate: true,
  });
});
it('warns before the first save about another draft within the same project', async () => {
  vi.mocked(api).mockResolvedValue({ sha256: 'same-bytes' });
  useReportPhotoDrafts.getState().update('user:another-report', () => ({
    photos: [{ id: '1', pointKey: 'other-point', asset, caption: '', sha256: 'same-bytes' }],
    removedIds: [],
    projectId: 'work-a',
  }));
  await expect(checkReportPhoto(asset, 'user:new', { projectId: 'work-a' })).resolves.toEqual({
    sha256: 'same-bytes',
    duplicate: true,
  });
  expect(vi.mocked(api).mock.calls[0]?.[0]).toBe('/reports/media/check');
  expect(useReportPhotoDrafts.getState().reports['user:new']).toBeUndefined();
});
it('allows the same photo from another work, including drafts that have not been saved', async () => {
  vi.mocked(api).mockResolvedValue({ sha256: 'same-bytes', projectId: 'work-b' });
  useReportPhotoDrafts.getState().update('user:another-report', () => ({
    projectId: 'work-a',
    photos: [{ id: '1', pointKey: 'other', asset, caption: '', sha256: 'same-bytes' }],
    removedIds: [],
  }));
  await expect(checkReportPhoto(asset, 'user:new', { projectId: 'work-b' })).resolves.toEqual({
    sha256: 'same-bytes',
    duplicate: false,
  });
  expect((vi.mocked(api).mock.calls[0]![1]!.body as FormData).get('projectId')).toBe('work-b');
});
it('returns a fingerprint for a new image and leaves the queue unchanged', async () => {
  vi.mocked(api).mockResolvedValue({ sha256: 'unique' });
  await expect(checkReportPhoto(asset, 'user:new', {})).resolves.toEqual({
    sha256: 'unique',
    duplicate: false,
  });
  expect(useReportPhotoDrafts.getState().reports).toEqual({});
});
it('keeps a server duplicate or failed check out of the pending queue', async () => {
  vi.mocked(api).mockRejectedValue(new Error('Esta imagem já foi utilizada.'));
  await expect(checkReportPhoto(asset, 'user:new', {})).rejects.toThrow('já foi utilizada');
  expect(useReportPhotoDrafts.getState().reports).toEqual({});
});

it('warns about another selection of the same file in the same draft', async () => {
  vi.mocked(api).mockResolvedValue({ sha256: 'same-bytes' });
  useReportPhotoDrafts.getState().update('user:new', () => ({
    photos: [{ id: '1', pointKey: 'point-a', asset, caption: '', sha256: 'same-bytes' }],
    removedIds: [],
  }));
  await expect(checkReportPhoto(asset, 'user:new', {})).resolves.toEqual({
    sha256: 'same-bytes',
    duplicate: true,
  });
});
it('returns a duplicate decision for the server warning without queueing the image', async () => {
  vi.mocked(api).mockRejectedValue(
    new ApiError(409, 'DUPLICATE_MEDIA', 'Foto repetida', { sha256: 'server-hash' }),
  );
  await expect(checkReportPhoto(asset, 'user:new', {})).resolves.toEqual({
    sha256: 'server-hash',
    duplicate: true,
  });
  expect(useReportPhotoDrafts.getState().reports).toEqual({});
});
it('sends persisted point context and keeps local identifiers out of the API', async () => {
  vi.mocked(api).mockResolvedValue({ sha256: 'unique' });
  await checkReportPhoto(asset, 'user:report', {
    reportId: 'report',
    persistedPointId: 'point',
  });
  const form = vi.mocked(api).mock.calls[0]![1]!.body as FormData;
  expect(form.get('reportId')).toBe('report');
  expect(form.get('reportPointId')).toBe('point');
  expect(form.get('warnOnSamePoint')).toBe('true');
  await checkReportPhoto(asset, 'user:report', { reportId: 'report' });
  expect((vi.mocked(api).mock.calls[1]![1]!.body as FormData).get('reportPointId')).toBeNull();
});

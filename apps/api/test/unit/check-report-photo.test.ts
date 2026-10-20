import { beforeEach, expect, it, vi } from 'vitest';
import { api } from '../../../app/services/api';
import { checkReportPhoto } from '../../../app/features/reports/check-report-photo';
import { useReportPhotoDrafts } from '../../../app/features/reports/report-photo-drafts';

vi.mock('../../../app/services/api', () => ({ api: vi.fn(), jsonBody: vi.fn() }));
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
  useReportPhotoDrafts.setState({ reports: {} });
});
it('checks before the first save and blocks a photo already selected in another point or draft', async () => {
  vi.mocked(api).mockResolvedValue({ sha256: 'same-bytes' });
  useReportPhotoDrafts.getState().update('user:another-report', () => ({
    photos: [{ id: '1', pointKey: 'other-point', asset, caption: '', sha256: 'same-bytes' }],
    removedIds: [],
  }));
  await expect(checkReportPhoto(asset, 'user:new', { pointId: 'new-point' })).rejects.toThrow(
    'já foi selecionada',
  );
  expect(vi.mocked(api).mock.calls[0]?.[0]).toBe('/reports/media/check');
  expect(useReportPhotoDrafts.getState().reports['user:new']).toBeUndefined();
});
it('returns a fingerprint for a new image and leaves the queue unchanged', async () => {
  vi.mocked(api).mockResolvedValue({ sha256: 'unique' });
  await expect(checkReportPhoto(asset, 'user:new', { pointId: 'new-point' })).resolves.toBe(
    'unique',
  );
  expect(useReportPhotoDrafts.getState().reports).toEqual({});
});
it('keeps a server duplicate or failed check out of the pending queue', async () => {
  vi.mocked(api).mockRejectedValue(new Error('Esta imagem já foi utilizada.'));
  await expect(checkReportPhoto(asset, 'user:new', { pointId: 'new-point' })).rejects.toThrow(
    'já foi utilizada',
  );
  expect(useReportPhotoDrafts.getState().reports).toEqual({});
});

it('allows the same file twice in one point but rejects it in a different point of the same draft', async () => {
  vi.mocked(api).mockResolvedValue({ sha256: 'same-bytes' });
  useReportPhotoDrafts
    .getState()
    .update('user:new', () => ({
      photos: [{ id: '1', pointKey: 'point-a', asset, caption: '', sha256: 'same-bytes' }],
      removedIds: [],
    }));
  await expect(checkReportPhoto(asset, 'user:new', { pointId: 'point-a' })).resolves.toBe(
    'same-bytes',
  );
  await expect(checkReportPhoto(asset, 'user:new', { pointId: 'point-b' })).rejects.toThrow(
    'outro ponto',
  );
  await expect(checkReportPhoto(asset, 'user:new', { pointId: null })).rejects.toThrow(
    'outro ponto',
  );
});
it('sends persisted point context and keeps local identifiers out of the API', async () => {
  vi.mocked(api).mockResolvedValue({ sha256: 'unique' });
  await checkReportPhoto(asset, 'user:report', {
    reportId: 'report',
    pointId: 'point',
    persistedPointId: 'point',
  });
  const form = vi.mocked(api).mock.calls[0]![1]!.body as FormData;
  expect(form.get('reportId')).toBe('report');
  expect(form.get('reportPointId')).toBe('point');
  await checkReportPhoto(asset, 'user:report', { reportId: 'report', pointId: 'local-new-point' });
  expect((vi.mocked(api).mock.calls[1]![1]!.body as FormData).get('reportPointId')).toBeNull();
});

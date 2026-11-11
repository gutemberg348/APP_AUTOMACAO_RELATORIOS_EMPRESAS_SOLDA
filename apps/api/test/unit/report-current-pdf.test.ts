import { beforeEach, expect, it, vi } from 'vitest';
import { reportTypeCodes } from '@weldcosta/shared';
const mocks = vi.hoisted(() => ({ api: vi.fn(), localSignature: vi.fn() }));
vi.mock('../../../app/services/api', () => ({ api: mocks.api }));
vi.mock('../../../app/features/people/offline-signatures', () => ({
  localSignature: mocks.localSignature,
}));
vi.mock('../../../app/services/upload-file', () => ({
  appendUploadFile: async (
    form: FormData,
    asset: { name: string },
    _limit: number,
    field: string,
  ) => {
    if (asset.name === 'missing.jpg') throw new Error('Arquivo não encontrado.');
    form.append(field, new Blob(['PHOTO ' + asset.name]), asset.name);
  },
}));
import { prepareCurrentReportPdf } from '../../../app/features/reports/report-current-pdf';
import { useReportPhotoDrafts } from '../../../app/features/reports/report-photo-drafts';
import type { ReportFormValues } from '../../../app/features/reports/report-collections';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.api.mockResolvedValue({ token: 'current-pdf-token', warnings: [] });
  useReportPhotoDrafts.setState({ reports: {} });
});
it.each(reportTypeCodes)(
  'sends the current %s filling and available local photos without saving or discarding the queue',
  async () => {
    const values = {
      number: 'NOW',
      title: 'CURRENT',
      reportDate: '',
      specificData: {},
      drawings: [],
      signatures: [],
      points: [{ clientId: 'local', number: '2', type: 'WELD', data: { acceptable: true } }],
    } as ReportFormValues;
    const queue = {
      photos: ['ok.jpg', 'missing.jpg', 'ok2.jpg'].map((name, i) => ({
        id: String(i),
        pointKey: 'local',
        caption: '',
        asset: { uri: 'file://' + name, name },
      })),
      removedIds: ['removed'],
      captionEdits: { old: 'NEW CAPTION' },
      annotationEdits: { old: { elements: [] } },
    };
    useReportPhotoDrafts.getState().update('user:report', () => queue);
    await prepareCurrentReportPdf('report', values, 'user:report');
    expect(mocks.api).toHaveBeenCalledTimes(1);
    expect(mocks.api.mock.calls[0]![0]).toBe('/reports/report/pdf/as-is/prepare');
    expect(mocks.api.mock.calls[0]![1].accountId).toBe('user');
    const body = mocks.api.mock.calls[0]![1].body as FormData;
    const input = JSON.parse(String(body.get('data')));
    expect(input.values.title).toBe('CURRENT');
    expect(input.values.points[0].clientId).toBe('local');
    expect(input.photos.map((p: { fileIndex: number | null }) => p.fileIndex)).toEqual([
      0,
      null,
      1,
    ]);
    expect(input.photos[0].pointNumber).toBe('2');
    expect(body.getAll('files')).toHaveLength(2);
    expect(input.warnings.join(' ')).toContain('missing.jpg');
    expect(input.removedIds).toEqual(['removed']);
    expect(useReportPhotoDrafts.getState().reports['user:report']).toEqual(queue);
    expect(values.title).toBe('CURRENT');
  },
);

it('includes optional LP test photos in Download as is without converting them into point photos', async () => {
  const values = {
    number: 'LP-1',
    title: '',
    reportDate: '',
    specificData: {},
    drawings: [],
    signatures: [],
    points: [],
  } as ReportFormValues;
  useReportPhotoDrafts.getState().update('user:report', () => ({
    photos: [
      {
        id: 'test-photo',
        pointKey: null,
        sectionKey: 'test-photos',
        caption: '',
        asset: { uri: 'file://test.jpg', name: 'test.jpg' },
      },
    ],
    removedIds: [],
  }));
  await prepareCurrentReportPdf('report', values, 'user:report');
  const form = mocks.api.mock.calls[0]![1].body as FormData;
  expect(JSON.parse(String(form.get('data'))).photos[0]).toMatchObject({
    sectionKey: 'test-photos',
    pointKey: null,
    fileIndex: 0,
  });
  expect(useReportPhotoDrafts.getState().reports['user:report']?.photos).toHaveLength(1);
});

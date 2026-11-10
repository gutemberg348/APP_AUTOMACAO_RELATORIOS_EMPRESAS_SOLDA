import { beforeEach, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { newDrawingData, reportTypeCodes, type CurrentUser } from '@weldcosta/shared';
import { preparePdfAsIs, pdfAsIsSchema } from '../../src/modules/pdf/pdf-as-is';
import type { PdfReport } from '../../src/modules/pdf/templates/reports/layout';
import { PdfExportDownloads } from '../../src/modules/pdf/pdf-export-downloads';
const mocks = vi.hoisted(() => ({ get: vi.fn(), signature: vi.fn() }));
vi.mock('../../src/config/env', () => ({ env: { STORAGE_PATH: '.' } }));
vi.mock('../../src/prisma/client', () => ({
  prisma: { signatureAsset: { findFirst: mocks.signature } },
}));
vi.mock('../../src/services/storage/local-storage-provider', () => ({
  LocalStorageProvider: class {
    get = mocks.get;
  },
}));
const user = { id: 'user-a', role: { code: 'ADMIN' } } as CurrentUser;
const base = (code: string) =>
  ({
    id: 'report',
    number: '001',
    title: 'OLD TITLE',
    reportDate: null,
    status: 'DRAFT',
    version: 1,
    company: { name: 'Company' },
    project: { name: 'Project' },
    reportType: { code, config: {} },
    specificData: {},
    points: [{ id: 'saved-point', number: '1', type: 'WELD', data: {} }],
    media: [
      {
        id: 'old-photo',
        reportPointId: 'saved-point',
        filePath: 'original.jpg',
        originalName: 'saved.jpg',
        sectionKey: 'photos',
        mimeType: 'image/jpeg',
      },
    ],
    drawings: [],
    signatures: [],
  }) as unknown as PdfReport;
beforeEach(() => {
  vi.clearAllMocks();
});
it.each(reportTypeCodes)(
  'includes current values, local and orphan photos in %s despite a bad point and a broken image',
  async (code) => {
    const image = await sharp({
      create: { width: 40, height: 60, channels: 3, background: '#1764C0' },
    })
      .png()
      .toBuffer();
    mocks.get.mockResolvedValue(image);
    const original = base(code),
      before = structuredClone(original);
    const input = pdfAsIsSchema.parse({
      values: {
        number: 'CURRENT-2',
        title: 'CURRENT TITLE',
        reportDate: '2026-11-10',
        specificData: { finalReport: 'CURRENT CONCLUSION' },
        points: [
          { id: 'saved-point', number: '1', type: 'WELD', data: { acceptable: true } },
          {
            clientId: 'new-point',
            number: '2',
            type: 'MEASUREMENT',
            value: 'not-a-number',
            label: 'KEEP LABEL',
            data: { notes: 'KEEP NOTES' },
          },
        ],
        signatures: [],
        drawings: [
          {
            data: {
              ...newDrawingData(),
              notes: 'PRIVATE NOTE',
              notesDrawing: {
                elements: [{ id: 'note', type: 'text', text: 'PRIVATE INK', x: 10, y: 10 }],
              },
              elements: [{ id: 'public', type: 'text', text: 'PUBLIC TEXT', x: 100, y: 100 }],
            },
          },
        ],
      },
      photos: [
        {
          id: 'local',
          pointKey: 'new-point',
          pointNumber: '2',
          name: 'local.jpg',
          caption: '',
          fileIndex: 0,
        },
        {
          id: 'orphan',
          pointKey: 'unknown-point',
          name: 'orphan.jpg',
          caption: 'KEEP PHOTO',
          fileIndex: 0,
        },
        {
          id: 'bad',
          pointKey: 'new-point',
          pointNumber: '2',
          name: 'broken.jpg',
          caption: '',
          fileIndex: 1,
        },
      ],
    });
    const { report, images, warnings } = await preparePdfAsIs(
      original,
      input,
      [image, Buffer.from('broken')],
      user,
    );
    expect(report.title).toBe('CURRENT TITLE');
    expect(report.number).toBe('CURRENT-2');
    expect(report.points[1]).toMatchObject({
      label: 'KEEP LABEL',
      value: null,
      data: { notes: 'KEEP NOTES' },
    });
    expect(report.media).toHaveLength(3);
    expect(images.size).toBe(3);
    expect(report.media.find((m) => m.clientUploadId === 'local')?.reportPointId).toBe(
      report.points[1]!.id,
    );
    expect(report.media.find((m) => m.clientUploadId === 'orphan')?.reportPointId).toBeNull();
    expect(warnings.join(' ')).toContain('Ponto 2: leitura inválido');
    expect(warnings.join(' ')).toContain('orphan.jpg');
    expect(warnings.join(' ')).toContain('imagens complementares');
    expect(warnings.join(' ')).toContain('broken.jpg');
    expect(warnings.join(' ')).toContain('Somente esta foto ficará fora');
    expect(JSON.stringify(report.drawings)).not.toContain('PRIVATE');
    expect(JSON.stringify(report.drawings)).toContain('PUBLIC TEXT');
    expect(original).toEqual(before);
  },
);
it('preserves a good photo when its annotations fail and warns by name about missing server photos', async () => {
  const image = await sharp({
    create: { width: 30, height: 30, channels: 3, background: '#1764C0' },
  })
    .jpeg()
    .toBuffer();
  mocks.get.mockRejectedValue(new Error('missing'));
  const result = await preparePdfAsIs(
    base('LP'),
    pdfAsIsSchema.parse({
      values: { number: '001', title: 'Now', points: [] },
      photos: [
        {
          id: 'paint',
          pointKey: null,
          caption: '',
          name: 'paint.jpg',
          fileIndex: 0,
          annotations: { elements: [{ type: 'bad' }] },
        },
      ],
    }),
    [image],
    user,
  );
  expect(result.report.media).toHaveLength(1);
  expect(result.warnings.join(' ')).toContain('saved.jpg');
  expect(result.warnings.join(' ')).toContain('paint.jpg');
  expect(result.warnings.join(' ')).toContain('sem essas marcações');
});
it('keeps downloads private to both the report and user and expires them', () => {
  vi.useFakeTimers();
  try {
    const store = new PdfExportDownloads();
    const token = store.create('a', 'report', Buffer.from('%PDF-current'));
    expect(store.get('a', 'report', token).toString()).toBe('%PDF-current');
    expect(() => store.get('b', 'report', token)).toThrow('expirou');
    expect(() => store.get('a', 'other', token)).toThrow('expirou');
    vi.advanceTimersByTime(5 * 60000 + 1);
    expect(() => store.get('a', 'report', token)).toThrow('expirou');
  } finally {
    vi.useRealTimers();
  }
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { newDrawingData } from '@weldcosta/shared';
const mocks = vi.hoisted(() => ({
  snapshot: vi.fn(),
  exists: vi.fn(),
  get: vi.fn(),
  html: vi.fn(),
  archivedPdf: vi.fn(),
}));
vi.mock('../../src/prisma/client', () => ({
  prisma: { report: { findFirst: mocks.snapshot }, reportPdf: { findFirst: mocks.archivedPdf } },
}));
vi.mock('../../src/config/env', () => ({
  env: { STORAGE_PATH: '.', PDF_CHROME_EXECUTABLE: process.execPath },
}));
vi.mock('../../src/services/storage/local-storage-provider', () => ({
  LocalStorageProvider: class {
    exists = mocks.exists;
    get = mocks.get;
  },
}));
vi.mock('puppeteer-core', () => ({
  default: {
    launch: async () => ({
      newPage: async () => ({
        setJavaScriptEnabled: async () => {},
        setRequestInterception: async () => {},
        on: () => {},
        setContent: mocks.html,
        evaluate: async () => {},
        pdf: async () => Buffer.from('%PDF-test'),
      }),
      close: async () => {},
    }),
  },
}));
import { PdfService } from '../../src/modules/pdf/pdf.service';

const fixture = (code = 'LP') => ({
  id: 'report',
  number: '001',
  title: 'Inspeção parcial',
  reportDate: null,
  version: 1,
  status: 'DRAFT',
  specificData: {},
  company: { name: 'Empresa' },
  project: { name: 'Obra' },
  reportType: { code, name: code, config: {} },
  points: [],
  media: [],
  drawings: [],
  signatures: [],
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.exists.mockResolvedValue(true);
});
describe('PDF for incomplete reports and located errors', () => {
  it.each(['EVS', 'EVD', 'LP', 'TH', 'ME', 'RDO'])(
    'downloads an existing finalized %s through the current renderer, preserving its archive',
    async (code) => {
      const report = { ...fixture(code), status: 'FINISHED', version: 8 };
      mocks.snapshot.mockResolvedValue(report);
      mocks.archivedPdf.mockResolvedValue({ filePath: 'old-layout.pdf', version: 2 });
      mocks.get.mockResolvedValue(Buffer.from('OLD-PDF'));
      expect((await new PdfService().download('report')).toString()).toBe('%PDF-test');
      expect(mocks.html).toHaveBeenCalledOnce();
      expect(mocks.get).not.toHaveBeenCalled();
      expect(report.version).toBe(8);
      expect(report.status).toBe('FINISHED');
    },
  );
  it('does not serve an archived final PDF after the report is reopened', async () => {
    mocks.snapshot.mockResolvedValue(fixture());
    mocks.archivedPdf.mockResolvedValue({ filePath: 'old-layout.pdf' });
    await expect(new PdfService().download('report')).rejects.toMatchObject({
      code: 'PDF_NOT_FOUND',
    });
    expect(mocks.html).not.toHaveBeenCalled();
  });
  it.each(['EVS', 'EVD', 'LP', 'TH', 'ME', 'RDO'])(
    'renders incomplete %s without requiring final fields',
    async (code) => {
      mocks.snapshot.mockResolvedValue({
        ...fixture(code),
        signatures: [{ id: 's', role: 'CLIENT', name: '', signatureImagePath: null }],
      });
      expect((await new PdfService().preview('report')).toString()).toBe('%PDF-test');
      expect(mocks.html.mock.calls[0]?.[0]).toContain('001');
    },
  );
  it('locates a missing image in its drawing', async () => {
    mocks.snapshot.mockResolvedValue({
      ...fixture(),
      drawings: [
        {
          data: {
            ...newDrawingData(),
            elements: [
              {
                id: 'image',
                type: 'image',
                mediaKey: 'missing',
                x: 500,
                y: 400,
                width: 200,
                height: 100,
                rotation: 0,
              },
            ],
          },
        },
      ],
    });
    await expect(new PdfService().preview('report')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      details: [{ path: ['drawings', 0, 'data', 'elements', 0, 'mediaKey'] }],
    });
  });
  it('locates a missing photo in its inspection point', async () => {
    mocks.exists.mockResolvedValue(false);
    mocks.snapshot.mockResolvedValue({
      ...fixture(),
      points: [{ id: 'point', number: '9' }],
      media: [
        {
          id: 'm',
          reportPointId: 'point',
          originalName: 'solda.jpg',
          filePath: 'gone.jpg',
          mimeType: 'image/jpeg',
        },
      ],
    });
    await expect(new PdfService().preview('report')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      details: [{ path: ['points', 0, 'photos'], message: expect.stringContaining('solda.jpg') }],
    });
  });
  it('locates a missing signature', async () => {
    mocks.exists.mockResolvedValue(false);
    mocks.snapshot.mockResolvedValue({
      ...fixture(),
      signatures: [{ id: 's', name: 'Cliente', signatureImagePath: 'gone.png' }],
    });
    await expect(new PdfService().preview('report')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      details: [{ path: ['signatures', 0, 'signatureAssetId'] }],
    });
  });
});

import { afterEach, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
const mocks = vi.hoisted(() => ({ blob: vi.fn(), write: vi.fn(), share: vi.fn() }));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('../../../app/services/api', () => ({ apiBlob: mocks.blob }));
const appRequire = createRequire(new URL('../../../app/services/report-pdf.ts', import.meta.url));
vi.doMock(appRequire.resolve('expo-sharing'), () => ({
  isAvailableAsync: async () => true,
  shareAsync: mocks.share,
}));
vi.doMock(appRequire.resolve('expo-file-system'), () => ({
  Paths: { cache: 'cache' },
  File: class {
    uri: string;
    constructor(...parts: string[]) {
      this.uri = parts.join('/');
    }
    create() {}
    write(bytes: Uint8Array) {
      mocks.write(this.uri, bytes);
    }
  },
}));
const { downloadReportPdf } = await import('../../../app/services/report-pdf');

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
it('opens each fresh PDF using a new URI even when downloading the same report in the same millisecond', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(12345);
  vi.stubGlobal(
    'FileReader',
    class {
      result = '';
      onload?: () => void;
      readAsDataURL() {
        this.result = 'data:application/pdf;base64,JVBERi1uZXc=';
        this.onload?.();
      }
    },
  );
  mocks.blob.mockResolvedValue(new Blob(['%PDF-new']));
  await downloadReportPdf('report-id', true);
  await downloadReportPdf('report-id', true);
  const first = mocks.share.mock.calls[0]![0],
    second = mocks.share.mock.calls[1]![0];
  expect(first).not.toBe(second);
  expect(first).toContain('report-id-previa.pdf');
  expect(second).toContain('report-id-previa.pdf');
  expect(mocks.blob).toHaveBeenCalledTimes(2);
  expect(mocks.write.mock.calls.map(([, bytes]) => new TextDecoder().decode(bytes))).toEqual([
    '%PDF-new',
    '%PDF-new',
  ]);
});

import { afterEach, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
const mocks = vi.hoisted(() => ({ blob: vi.fn(), write: vi.fn(), share: vi.fn() }));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('../../../app/services/api', () => ({
  apiBlob: mocks.blob,
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
  vi.useRealTimers();
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

it('reports preparation stages and uses native arrayBuffer without FileReader', async () => {
  const reader = vi.fn();
  vi.stubGlobal('FileReader', reader);
  const progress = vi.fn();
  mocks.blob.mockResolvedValue(new Blob(['%PDF-native']));
  await downloadReportPdf('report-id', false, true, { onProgress: progress });
  expect(reader).not.toHaveBeenCalled();
  expect(progress.mock.calls.flat()).toEqual(['download', 'prepare', 'open']);
  expect(new TextDecoder().decode(mocks.write.mock.calls[0]![1])).toBe('%PDF-native');
});

it('falls back to FileReader for older native Blob implementations', async () => {
  const blob = new Blob(['%PDF-old']);
  Object.defineProperty(blob, 'arrayBuffer', { value: undefined });
  mocks.blob.mockResolvedValue(blob);
  vi.stubGlobal(
    'FileReader',
    class {
      result = 'data:application/pdf;base64,JVBERi1vbGQ=';
      onload?: () => void;
      readAsDataURL() {
        this.onload?.();
      }
    },
  );
  await downloadReportPdf('report-id', true);
  expect(new TextDecoder().decode(mocks.write.mock.calls[0]![1])).toBe('%PDF-old');
});

it('does not wait forever when native PDF preparation hangs', async () => {
  vi.useFakeTimers();
  mocks.blob.mockResolvedValue({ size: 9, arrayBuffer: () => new Promise(() => {}) });
  const check = expect(downloadReportPdf('report-id', true)).rejects.toThrow('a tempo');
  await vi.advanceTimersByTimeAsync(30000);
  await check;
  expect(mocks.share).not.toHaveBeenCalled();
});

it('does not share after cancellation or failure writing the local PDF', async () => {
  const controller = new AbortController();
  mocks.blob.mockResolvedValue(new Blob(['%PDF-native']));
  controller.abort();
  await expect(
    downloadReportPdf('report-id', true, false, { signal: controller.signal }),
  ).rejects.toMatchObject({ code: 'REQUEST_CANCELLED' });
  expect(mocks.share).not.toHaveBeenCalled();
  mocks.write.mockImplementationOnce(() => {
    throw new Error('disk full');
  });
  await expect(downloadReportPdf('report-id', true)).rejects.toThrow('espaço livre');
  expect(mocks.share).not.toHaveBeenCalled();
});

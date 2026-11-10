import { afterEach, expect, it, vi } from 'vitest';
import { PdfRenderCache, pdfRenderKey } from '../../src/modules/pdf/pdf-render-cache';
import type { PdfReport } from '../../src/modules/pdf/templates/reports/layout';

afterEach(() => vi.useRealTimers());

it('reuses identical work, evicts by byte budget, expires and never caches failures', async () => {
  vi.useFakeTimers();
  const cache = new PdfRenderCache(6, 100);
  const render = vi.fn(async () => Buffer.from('PDF'));
  await Promise.all([cache.run('a', render), cache.run('a', render)]);
  expect(render).toHaveBeenCalledTimes(1);
  await cache.run('b', render);
  await cache.run('c', render);
  await cache.run('a', render);
  expect(render).toHaveBeenCalledTimes(4);
  await vi.advanceTimersByTimeAsync(101);
  await cache.run('a', render);
  expect(render).toHaveBeenCalledTimes(5);
  await expect(
    cache.run('bad', async () => {
      throw new Error('failed');
    }),
  ).rejects.toThrow('failed');
  expect(await cache.run('bad', render)).toEqual(Buffer.from('PDF'));
});

it('serializes different renders and times out queued work without running it later', async () => {
  vi.useFakeTimers();
  const cache = new PdfRenderCache(100, 1000, 100);
  let complete!: (bytes: Buffer) => void;
  const first = cache.run(
    'a',
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  await Promise.resolve();
  const render = vi.fn(async () => Buffer.from('second'));
  const check = expect(cache.run('b', render)).rejects.toMatchObject({ code: 'PDF_BUSY' });
  await vi.advanceTimersByTimeAsync(100);
  await check;
  complete(Buffer.from('first'));
  await first;
  expect(render).not.toHaveBeenCalled();
  expect(await cache.run('b', render)).toEqual(Buffer.from('second'));
});

it('keys every printable change, separates previews and final files, but ignores lifecycle-only updates', () => {
  const report = {
    id: 'a',
    version: 1,
    status: 'APPROVED',
    title: 'Original',
    media: [{ annotations: null }],
    company: { name: 'Empresa' },
  } as unknown as PdfReport;
  const key = pdfRenderKey(report, true);
  expect(
    pdfRenderKey(
      { ...report, version: 2, status: 'FINISHED', updatedAt: new Date(), finishedAt: new Date() },
      true,
    ),
  ).toBe(key);
  expect(pdfRenderKey(report, false)).not.toBe(key);
  for (const update of [
    { title: 'Editado' },
    { id: 'b' },
    { company: { name: 'Outra' } },
    { media: [{ annotations: { color: 'red' } }] },
  ])
    expect(pdfRenderKey({ ...report, ...update } as PdfReport, true)).not.toBe(key);
});

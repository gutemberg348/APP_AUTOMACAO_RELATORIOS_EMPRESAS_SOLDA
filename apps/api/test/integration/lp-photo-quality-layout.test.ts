import { afterAll, beforeAll, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import puppeteer, { type Browser } from 'puppeteer-core';
import sharp from 'sharp';
import { testPhotoSheets } from '../../src/modules/pdf/templates/reports/lp';
import { evsDocumentHtml } from '../../src/modules/pdf/templates/reports/evs';
import { paginateEvs } from '../../src/modules/pdf/templates/reports/evs/paginate';
import { photoWithAnnotations } from '../../src/modules/pdf/photo-annotations';
import type { PdfReport } from '../../src/modules/pdf/templates/reports/layout';

let browser: Browser;
beforeAll(async () => {
  browser = await puppeteer.launch({
    executablePath: [
      process.env.PDF_CHROME_EXECUTABLE,
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      '/usr/bin/chromium',
    ].find((p) => p && existsSync(p)),
    headless: true,
  });
});
afterAll(async () => browser?.close());

it.each([1, 3, 4])(
  'LP keeps equal frames and source resolution for %i test photos',
  async (count) => {
    const media = Array.from({ length: count }, (_, i) => ({
      id: String(i),
      sectionKey: 'test-photos',
      caption: i === 1 ? 'Detalhe do ensaio' : '',
    }));
    const report = {
      number: 'LP-001',
      reportDate: '2026-11-16',
      company: { name: 'Cliente' },
      project: { name: 'Obra' },
      reportType: { code: 'LP' },
      media,
    } as unknown as PdfReport;
    const images = new Map<string, string>();
    for (const [i, item] of media.entries()) {
      const [width, height] = [
        [1800, 1200],
        [1200, 1800],
        [1500, 1500],
      ][i % 3]!;
      const source = await sharp(
        Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#e5edf5"/><circle cx="${width! / 2}" cy="${height! / 2}" r="300" fill="#1764c0"/><text x="60" y="100" font-size="70">FOTO ${i + 1}</text><rect x="5" y="5" width="${width! - 10}" height="${height! - 10}" fill="none" stroke="#111" stroke-width="10"/></svg>`,
        ),
      )
        .png()
        .toBuffer();
      const prepared = await photoWithAnnotations(source, 'image/png', null);
      expect(Buffer.from(prepared.split(',')[1]!, 'base64')).toEqual(source);
      images.set(item.id, prepared);
    }
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: 850, height: 1200 });
      await page.setContent(evsDocumentHtml(testPhotoSheets(report, images), false));
      await page.evaluate(async () => {
        await Promise.all([...document.images].map((img) => img.decode()));
      });
      await page.evaluate(paginateEvs);
      const frames = await page.$$eval('.lp-test-photo-image', (nodes) =>
        nodes.map((node) => {
          const rect = node.getBoundingClientRect(),
            img = node.querySelector('img')!;
          return {
            width: rect.width,
            height: rect.height,
            fit: getComputedStyle(img).objectFit,
            pixels: img.naturalWidth,
            overflow: rect.bottom - node.closest('.evs-flow')!.getBoundingClientRect().bottom,
          };
        }),
      );
      expect(frames).toHaveLength(count);
      expect(await page.$$eval('.lp-test-photos', (nodes) => nodes.length)).toBe(
        Math.ceil(count / 3),
      );
      for (const frame of frames) {
        expect(frame.width).toBeCloseTo(frames[0]!.width);
        expect(frame.height).toBeCloseTo(frames[0]!.height);
        expect(frame.fit).toBe('contain');
        expect(frame.pixels).toBeGreaterThanOrEqual(1200);
        expect(frame.overflow).toBeLessThanOrEqual(0);
      }
      if (count === 3) {
        const folder = fileURLToPath(
          new URL('../../../../artifacts/lp-photo-quality/', import.meta.url),
        );
        await mkdir(folder, { recursive: true });
        await (await page.$('.lp-test-photos'))!.screenshot({ path: folder + 'three-photos.png' });
      }
    } finally {
      await page.close();
    }
  },
);

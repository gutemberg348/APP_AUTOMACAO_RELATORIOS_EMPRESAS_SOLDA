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

it.each([1, 2, 3, 4])(
  'LP stacks %i test photos in equal slots at source resolution',
  async (count) => {
    const media = Array.from({ length: count }, (_, i) => ({
      id: String(i),
      sectionKey: 'test-photos',
      caption: i === 1 && count !== 3 ? 'Detalhe do ensaio' : '',
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
      const sheets = await page.$$eval('.lp-test-photos .evs-flow', (flows) =>
        flows.map((flow) => {
          const bounds = flow.getBoundingClientRect();
          return [...flow.querySelectorAll('.lp-test-photo')].map((figure) => {
            const img = figure.querySelector('img')!;
            const rect = img.getBoundingClientRect();
            const style = getComputedStyle(figure);
            const ratio = img.naturalWidth / img.naturalHeight;
            return {
              top: rect.top,
              bottom: rect.bottom,
              height: rect.height,
              width: rect.width,
              areaHeight: bounds.height,
              visibleWidth: Math.min(rect.width, rect.height * ratio),
              visibleHeight: Math.min(rect.height, rect.width / ratio),
              fit: getComputedStyle(img).objectFit,
              pixels: [img.naturalWidth, img.naturalHeight],
              overflow: rect.bottom - bounds.bottom,
              borders: [style.borderTopWidth, style.borderBottomWidth],
              captionHeight:
                figure.querySelector('figcaption')?.getBoundingClientRect().height ?? 0,
            };
          });
        }),
      );
      const frames = sheets.flat();
      expect(frames).toHaveLength(count);
      expect(sheets.map((photos) => photos.length)).toEqual(count === 4 ? [3, 1] : [count]);
      const expectedPixels = [
        [1800, 1200],
        [1200, 1800],
        [1500, 1500],
      ];
      for (const [index, frame] of frames.entries()) {
        expect(frame.borders).toEqual(['0px', '0px']);
        expect(frame.fit).toBe('contain');
        expect(frame.pixels).toEqual(expectedPixels[index % 3]);
        expect(frame.width).toBeCloseTo(frames[0]!.width, 1);
        expect(frame.height).toBeCloseTo(frames[0]!.height, 1);
        expect(frame.height).toBeLessThanOrEqual(frame.areaHeight / 3);
        expect(frame.visibleHeight).toBeCloseTo(frame.height, 1);
        expect(frame.overflow).toBeLessThanOrEqual(0);
      }
      for (const photos of sheets) {
        for (let i = 1; i < photos.length; i++) {
          expect(photos[i]!.top).toBeCloseTo(
            photos[i - 1]!.bottom + photos[i - 1]!.captionHeight,
            1,
          );
        }
      }
      expect(frames[0]!.visibleWidth).toBeGreaterThan((102 * 96) / 25.4);
      if (count === 4) {
        expect(sheets[1]![0]!.visibleWidth).toBeCloseTo(sheets[0]![0]!.visibleWidth, 1);
        expect(sheets[1]![0]!.visibleHeight).toBeCloseTo(sheets[0]![0]!.visibleHeight, 1);
        const folder = fileURLToPath(
          new URL('../../../../artifacts/lp-photo-quality/', import.meta.url),
        );
        await mkdir(folder, { recursive: true });
        await page.pdf({
          path: folder + 'uniform-photos.pdf',
          preferCSSPageSize: true,
          printBackground: true,
        });
      }
    } finally {
      await page.close();
    }
  },
);

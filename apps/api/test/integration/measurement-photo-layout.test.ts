import { afterAll, beforeAll, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import puppeteer, { type Browser } from 'puppeteer-core';
import { render } from '../../src/modules/pdf/templates/reports/thickness';
import { evsDocumentHtml } from '../../src/modules/pdf/templates/reports/evs';
import { paginateEvs } from '../../src/modules/pdf/templates/reports/evs/paginate';
import sharp from 'sharp';
import { photoForPdf } from '../../src/modules/pdf/photo-annotations';
import type { PdfReport } from '../../src/modules/pdf/templates/reports/layout';

let browser: Browser;
beforeAll(async () => {
  const executablePath = [
    process.env.PDF_CHROME_EXECUTABLE,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/chromium',
  ].find((f) => f && existsSync(f));
  browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: process.env.PDF_DISABLE_SANDBOX === 'true' ? ['--no-sandbox'] : [],
  });
});
afterAll(async () => browser?.close());

it.each([0, 1, 4, 7, 12])(
  'ME lays out %i photos with per-photo readings, no drawing or empty support rows',
  async (count) => {
    const media = Array.from({ length: count }, (_, i) => ({
      id: 'photo-' + i,
      sectionKey: 'test-photos',
      reportPointId: null,
      annotations: {
        elements: [],
        ...(i < 2
          ? {
              measurementDetails: {
                side: i ? 'DIREITO' : 'ESQUERDO',
                discontinuity: '-',
                acceptable: true,
                projectThickness: '6 mm',
              },
              measurements: Array.from({ length: i ? 4 : 5 }, (_, n) => ({
                id: 'm-' + n,
                number: String(i * 5 + n + 1),
                x: 0.15 + n * 0.15,
                y: 0.4 + (n % 2) * 0.2,
                value: n === 0 ? 0 : 5.9,
              })),
            }
          : {}),
      },
    }));
    const report = {
      number: '001',
      title: 'TANQUE PULMÃO',
      reportDate: '2026-01-14',
      reportType: { code: 'ME' },
      company: { name: 'CLIENTE' },
      project: { name: 'OBRA' },
      specificData: {
        owner: 'CLIENTE',
        work: 'OBRA',
        project: 'TANQUE PULMÃO',
        inspectionType: 'MEDIÇÃO DE ESPESSURA',
        projectThickness: '6 mm',
      },
      media,
      points: [],
      drawings: [],
      signatures: [],
    } as unknown as PdfReport;
    const images = new Map(
      await Promise.all(
        media.map(async (m, i): Promise<[string, string]> => {
          const bytes = await sharp(
            Buffer.from(
              `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#d4e2e8"/><rect x="60" y="150" width="650" height="300" rx="90" fill="#a0b1ba" stroke="#526c7a" stroke-width="4"/><text x="300" y="80" font-size="32">FOTO ${i + 1}</text></svg>`,
            ),
          )
            .png()
            .toBuffer();
          return [m.id, await photoForPdf(bytes, 'image/png', m.annotations)];
        }),
      ),
    );
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: 850, height: 1250 });
      await page.setContent(evsDocumentHtml(render(report, images), false));
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
      });
      await page.evaluate(paginateEvs);
      const photos = await page.$$eval('.measurement-photo', (frames) =>
        frames.map((f) => {
          const image = f.querySelector('img')!;
          const cell = f.closest('.measurement-cell')!;
          const flow = f.closest('.evs-flow')!.getBoundingClientRect();
          return {
            width: f.clientWidth,
            height: f.clientHeight,
            fit: getComputedStyle(image).objectFit,
            overflow: cell.getBoundingClientRect().bottom - flow.bottom,
            readings: cell.querySelectorAll('.measurement-reading').length,
            text: cell.textContent,
          };
        }),
      );
      expect(photos).toHaveLength(count);
      expect(photos.map((p) => p.readings)).toEqual(
        media.map((m) => m.annotations.measurements?.length ?? 0),
      );
      expect(await page.$$eval('.evs-sheet', (sheets) => sheets.length)).toBe(
        3 + Math.ceil(count / 4),
      );
      photos.forEach((photo, i) => {
        expect(photo.width).toBeGreaterThan(300);
        expect(photo.height).toBeGreaterThan(220);
        expect(photo.fit).toBe('fill');
        expect(photo.overflow).toBeLessThanOrEqual(1);
        if (i >= 2) expect(photo.text?.trim()).toBe('');
      });
      if (count === 4) {
        const directory = fileURLToPath(
          new URL('../../../../artifacts/me-comparison', import.meta.url),
        );
        await mkdir(directory, { recursive: true });
        await (await page.$('article.measurement-sheet:not(.reference-final)'))!.screenshot({
          path: directory + '/updated-measurements.png',
        });
        const alignment = await page.$$eval('.measurement-columns', (pairs) =>
          pairs.map((pair) => {
            const imgs = [...pair.querySelectorAll('.measurement-photo')].map((f) =>
              f.getBoundingClientRect(),
            );
            return Math.abs(imgs[0]!.top - imgs[1]!.top);
          }),
        );
        alignment.forEach((delta) => expect(delta).toBeLessThan(1));
      }
    } finally {
      await page.close();
    }
  },
);

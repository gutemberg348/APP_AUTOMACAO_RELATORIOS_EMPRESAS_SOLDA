import { afterAll, beforeAll, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer, { type Browser } from 'puppeteer-core';
import { render } from '../../src/modules/pdf/templates/reports/hydrostatic';
import { evsDocumentHtml } from '../../src/modules/pdf/templates/reports/evs';
import { paginateEvs } from '../../src/modules/pdf/templates/reports/evs/paginate';
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

it.each([0, 1, 3, 6, 7, 13])(
  'TH lays out %i portrait/landscape photos in consecutive pairs with unused space below',
  async (count) => {
    const media = Array.from({ length: count }, (_, i) => ({
      id: 'photo-' + i,
      sectionKey: i % 2 ? 'test-photos' : 'photos',
      reportPointId: i % 2 ? null : 'old-point',
      caption: '',
    }));
    const report = {
      number: 'TH-005',
      title: 'TANQUE PULMÃO',
      reportDate: '2026-11-13',
      reportType: { code: 'TH' },
      company: { name: 'CLIENTE' },
      project: { name: 'OBRA' },
      specificData: {
        client: 'CLIENTE',
        owner: 'CLIENTE',
        work: 'OBRA',
        project: 'TANQUE PULMÃO',
        testFluid: 'ÁGUA',
        generalData: { workingPressure: '10 BAR', testPressure: '15 BAR' },
      },
      media,
      points: [
        { id: 'old-point', number: '1', data: {} },
        { id: 'empty', number: '2', data: {} },
      ],
      drawings: [],
      signatures: [],
    } as unknown as PdfReport;
    const images = new Map(
      media.map((m, i) => [
        m.id,
        'data:image/svg+xml,' +
          encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${i % 2 ? 400 : 800}" height="${i % 2 ? 800 : 400}"><rect width="100%" height="100%" fill="${['#1764c0', '#16725b', '#ea580c'][i % 3]}"/><text x="20" y="100" fill="white" font-size="50">FOTO ${i + 1}</text></svg>`,
          ),
      ]),
    );
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: 850, height: 1200 });
      await page.setContent(evsDocumentHtml(render(report, images), false));
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
      });
      await page.evaluate(paginateEvs);
      const result = await page.$$eval('.th-test-photos', (sheets) =>
        sheets.map((sheet) => {
          const flow = sheet.querySelector('.evs-flow')!.getBoundingClientRect();
          const rows = [...sheet.querySelectorAll('.th-test-photo-row')].map((row) =>
            row.getBoundingClientRect(),
          );
          return {
            count: sheet.querySelectorAll('.th-test-photo-image img').length,
            top: rows[0]!.top - flow.top,
            bottomSpace: flow.bottom - rows.at(-1)!.bottom,
            rows: rows.map((row) => ({ height: row.height, bottom: row.bottom - flow.bottom })),
            images: [...sheet.querySelectorAll('.th-test-photo-image img')].map((img) => {
              const r = img.getBoundingClientRect();
              return { width: r.width, height: r.height, fit: getComputedStyle(img).objectFit };
            }),
          };
        }),
      );
      expect(result.map((p) => p.count)).toEqual(
        Array.from({ length: Math.ceil(count / 6) }, (_, i) => Math.min(6, count - i * 6)),
      );
      expect(await page.$$eval('.evs-sheet', (sheets) => sheets.length)).toBe(
        4 + Math.ceil(count / 6),
      );
      for (const sheet of result) {
        expect(Math.abs(sheet.top)).toBeLessThan(1);
        sheet.rows.forEach((row) => expect(row.bottom).toBeLessThanOrEqual(1));
        sheet.images.forEach((img) => {
          expect(img.width).toBeGreaterThan(250);
          expect(img.height).toBeGreaterThan(200);
          expect(img.fit).toBe('fill');
        });
        if (sheet.count <= 4) expect(sheet.bottomSpace).toBeGreaterThan(200);
      }
      if (count === 7) {
        const output = fileURLToPath(
          new URL('../../../../artifacts/th-comparison', import.meta.url),
        );
        await mkdir(output, { recursive: true });
        const sheets = await page.$$('.th-test-photos');
        await sheets[0]!.screenshot({ path: path.join(output, 'updated-six.png') });
        await sheets[1]!.screenshot({ path: path.join(output, 'updated-one.png') });
      }
    } finally {
      await page.close();
    }
  },
);

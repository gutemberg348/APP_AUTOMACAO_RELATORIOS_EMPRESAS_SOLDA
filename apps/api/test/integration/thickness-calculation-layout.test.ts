import { afterAll, beforeAll, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import puppeteer, { type Browser } from 'puppeteer-core';
import { newCustomReportPage } from '@weldcosta/shared';
import { render } from '../../src/modules/pdf/templates/reports/thickness';
import { renderWithCustomPages } from '../../src/modules/pdf/templates/reports/custom-pages';
import { reportForPdf } from '../../src/modules/pdf/pdf-snapshot';
import { evsDocumentHtml } from '../../src/modules/pdf/templates/reports/evs';
import { paginateEvs } from '../../src/modules/pdf/templates/reports/evs/paginate';
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
it.each(['notAdded', 'blank', 'photo'])(
  'prints only the optional calculation page when selected: %s',
  async (mode) => {
    const custom = newCustomReportPage('calculation');
    if (mode === 'photo') {
      custom.title = 'MEMORIAL DO CLIENTE';
      custom.drawings[0]!.data.elements = [
        {
          id: 'image',
          type: 'image',
          mediaKey: 'drawing-image-calculation',
          x: 540,
          y: 350,
          width: 500,
          height: 380,
          rotation: 15,
        },
        { id: 'ink', type: 'line', x1: 100, y1: 150, x2: 250, y2: 210, strokeColor: '#dc2626' },
        { id: 'text', type: 'text', x: 200, y: 240, text: 'ANOTACAO TESTE' },
      ];
    }
    const report = {
      number: '001',
      title: 'QA',
      reportDate: '2026-11-17',
      reportType: { code: 'ME' },
      company: { name: 'CLIENTE' },
      project: { name: 'OBRA' },
      points: [],
      drawings: [],
      signatures: [],
      media:
        mode === 'photo'
          ? [
              {
                id: 'photo',
                clientUploadId: 'drawing-image-calculation',
                sectionKey: 'drawing',
                reportPointId: null,
                mimeType: 'image/png',
                originalName: 'calculation.png',
              },
            ]
          : [],
      specificData: {
        calculationMinimumThickness: '3,33',
        ...(mode === 'notAdded' ? {} : { customPages: [custom] }),
      },
    } as unknown as PdfReport;
    const uri =
      'data:image/svg+xml;base64,' +
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="380"><rect width="500" height="380" fill="#e4edf5"/><text x="80" y="180" font-size="24">FOTO DO CALCULO</text></svg>',
      ).toString('base64');
    const html = renderWithCustomPages(reportForPdf(report), new Map([['photo', uri]]), render);
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: 850, height: 1250 });
      await page.setContent(evsDocumentHtml(html, false));
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map((image) => image.decode()));
      });
      await page.evaluate(paginateEvs);
      expect(await page.$$('.measurement-calculation-sheet')).toHaveLength(0);
      expect(await page.$$('.evs-sheet')).toHaveLength(mode === 'notAdded' ? 3 : 4);
      expect(await page.$$('.custom-report-sheet')).toHaveLength(mode === 'notAdded' ? 0 : 1);
      if (mode !== 'notAdded') {
        expect(await page.$eval('.custom-report-sheet .evs-heading', (e) => e.textContent)).toBe(
          custom.title,
        );
        expect(await page.$$('.custom-report-sheet .evs-header')).toHaveLength(1);
        expect(await page.$$('.custom-drawing [data-print-drawing-content]')).toHaveLength(0);
        if (mode === 'photo') {
          expect(await page.$eval('.custom-drawing image', (e) => Number(e.getAttribute('width')))).toBeCloseTo(500, 5);
          expect(await page.$eval('.custom-drawing', (e) => e.textContent)).toContain(
            'ANOTACAO TESTE',
          );
          const directory = fileURLToPath(
            new URL('../../../../artifacts/custom-pages', import.meta.url),
          );
          await mkdir(directory, { recursive: true });
          await (await page.$('.custom-report-sheet'))!.screenshot({
            path: directory + '/calculation-photo-page.png',
          });
        }
      }
    } finally {
      await page.close();
    }
  },
);

import { afterAll, beforeAll, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import puppeteer, { type Browser } from 'puppeteer-core';
import { thicknessCalculationFields } from '@weldcosta/shared';
import { render } from '../../src/modules/pdf/templates/reports/thickness';
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

it.each(['sample', 'empty', 'long'])('renders the ME calculation sheet: %s', async (mode) => {
  const values = [
    '3,33',
    '0,58836',
    '88,9',
    '114',
    '0,7',
    '3',
    '77,9',
    '1,0',
    '0,4',
    '6,0',
    '3,50',
  ];
  const data =
    mode === 'empty'
      ? {}
      : Object.fromEntries(
          thicknessCalculationFields.map((f, i) => [
            f.path,
            mode === 'long' ? 'A'.repeat(100) : values[i],
          ]),
        );
  const report = {
    number: '001',
    title: 'SERPENTINA',
    reportDate: '2026-01-12',
    reportType: { code: 'ME' },
    company: { name: 'QA' },
    project: { name: 'QA' },
    specificData: data,
    points: [],
    media: [],
    drawings: [],
    signatures: [],
  } as unknown as PdfReport;
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 850, height: 1250 });
    await page.setContent(evsDocumentHtml(render(report, new Map()), false));
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(paginateEvs);
    const results = await page.$$eval('.measurement-calculation-sheet', (sheets) =>
      sheets.map((sheet) => {
        const flow = sheet.querySelector('.evs-flow')!.getBoundingClientRect();
        return {
          text: sheet.textContent,
          overflow: Math.max(
            ...Array.from(sheet.querySelector('.evs-flow')!.children).map(
              (c) => c.getBoundingClientRect().bottom - flow.bottom,
            ),
          ),
        };
      }),
    );
    expect(results.length).toBeGreaterThan(0);
    results.forEach((result) => expect(result.overflow).toBeLessThanOrEqual(1));
    expect(results.map((r) => r.text).join('')).toContain('Espessura encontrada');
    if (mode === 'sample') {
      expect(results).toHaveLength(1);
      values.forEach((value) => expect(results[0]!.text).toContain(value));
      const directory = fileURLToPath(
        new URL('../../../../artifacts/me-comparison', import.meta.url),
      );
      await mkdir(directory, { recursive: true });
      await (await page.$('.measurement-calculation-sheet'))!.screenshot({
        path: directory + '/calculation-sheet.png',
      });
    }
  } finally {
    await page.close();
  }
});

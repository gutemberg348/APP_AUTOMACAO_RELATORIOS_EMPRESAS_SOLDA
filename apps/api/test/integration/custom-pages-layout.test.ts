import { afterAll, beforeAll, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import puppeteer, { type Browser } from 'puppeteer-core';
import {
  customReportPageSchema,
  customPhotoPrefix,
  newDrawingData,
  reportTypeCodes,
} from '@weldcosta/shared';
import { renderWithCustomPages } from '../../src/modules/pdf/templates/reports/custom-pages';
import { evsDocumentHtml, render as evs } from '../../src/modules/pdf/templates/reports/evs';
import { render as lp } from '../../src/modules/pdf/templates/reports/lp';
import { render as th } from '../../src/modules/pdf/templates/reports/hydrostatic';
import { render as me } from '../../src/modules/pdf/templates/reports/thickness';
import { render as rdo } from '../../src/modules/pdf/templates/reports/rdo';
import { paginateEvs } from '../../src/modules/pdf/templates/reports/evs/paginate';
import { reportForPdf } from '../../src/modules/pdf/pdf-snapshot';
import type { PdfReport } from '../../src/modules/pdf/templates/reports/layout';

let browser: Browser;
beforeAll(async () => {
  browser = await puppeteer.launch({
    executablePath: [
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      '/usr/bin/chromium',
    ].find(existsSync),
    headless: true,
  });
});
afterAll(async () => browser?.close());
const templates = { EVS: evs, EVD: evs, LP: lp, TH: th, ME: me, RDO: rdo };
it.each(reportTypeCodes)(
  'places blank pages anywhere in the paginated %s, including after signatures',
  async (code) => {
    const extra = (id: string, title: string, position: string, afterPage?: number) =>
      customReportPageSchema.parse({
        id,
        kind: 'blank',
        title,
        position,
        afterPage,
        drawings: [{ data: { ...newDrawingData(), grid: 'none', page: 'portrait' } }],
      });
    const extras = [
      extra('end', 'EXTRA END', 'end'),
      extra('after', 'EXTRA AFTER 2', 'afterPage', 2),
      extra('start', 'EXTRA START', 'start'),
      extra('signatures', 'EXTRA AFTER SIGNATURES', 'afterSignatures'),
    ];
    const report = {
      number: '001',
      title: 'QA',
      reportType: { code },
      project: { name: 'OBRA' },
      company: { name: 'CLIENTE' },
      specificData: {
        customPages: extras,
        owner: 'LONG FIELD '.repeat(300),
        finalReport: 'LONG CONCLUSION '.repeat(300),
        observation: 'LONG OBSERVATION '.repeat(300),
      },
      points: [],
      drawings: [],
      media: [],
      signatures: [],
    } as unknown as PdfReport;
    const page = await browser.newPage();
    try {
      await page.setContent(
        evsDocumentHtml(
          renderWithCustomPages(reportForPdf(report), new Map(), templates[code]),
          false,
        ),
      );
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(paginateEvs);
      const result = await page.$$eval('.evs-sheet', (sheets) =>
        sheets.map((s) => ({
          title: s.querySelector('.evs-heading')!.textContent,
          extra: s.hasAttribute('data-custom-id'),
          signatures: !!s.querySelector('.evs-signers'),
          page: s.querySelector('.evs-page-number')!.textContent,
        })),
      );
      expect(result[0]!.title).toBe('EXTRA START');
    expect(result.at(-1)!.title).toBe('EXTRA END');
      const standard = result.filter((s) => !s.extra);
      expect(standard.length).toBeGreaterThan(2);
      expect(result[result.indexOf(standard[1]!) + 1]!.title).toBe('EXTRA AFTER 2');
      const signed = standard.filter((s) => s.signatures).at(-1)!;
      expect(result.findIndex((s) => s.title === 'EXTRA AFTER SIGNATURES')).toBeGreaterThan(
        result.indexOf(signed),
      );
      expect(result.filter((s) => s.extra)).toHaveLength(4);
      result.forEach((s, i) =>
        expect(s.page).toBe(
          String(i + 1).padStart(2, '0') + '/' + String(result.length).padStart(2, '0'),
        ),
      );
      expect(await page.$$eval('.custom-drawing svg text', (text) => text.length)).toBe(0);
      if (code === 'TH') {
        const directory = fileURLToPath(
          new URL('../../../../artifacts/custom-pages', import.meta.url),
        );
        await mkdir(directory, { recursive: true });
        await (await page.$('[data-custom-id="signatures"]'))!.screenshot({
          path: directory + '/blank-after-signatures.png',
        });
      }
    } finally {
      await page.close();
    }
  },
);
it('keeps long custom titles and point details inside their sheets and omits unused photo pages', async () => {
  const custom = customReportPageSchema.parse({
    id: 'details',
    kind: 'points',
    title: 'PÁGINA PERSONALIZADA COM IDENTIFICAÇÃO EXTENSA '.repeat(3),
    photosPerPage: 6,
    points: [
      {
        key: 'long-point',
        number: '01',
        label: 'L'.repeat(500),
        reading: '5,9 mm',
        discontinuity: 'D'.repeat(500),
        acceptable: true,
      },
    ],
  });
  const unused = customReportPageSchema.parse({
    id: 'empty',
    kind: 'photos',
    title: 'UNUSED PAGE',
  });
  const report = {
    number: '001',
    title: 'QA',
    reportDate: null,
    reportType: { code: 'ME' },
    company: { name: 'QA' },
    project: { name: 'QA' },
    specificData: { customPages: [custom, unused] },
    points: [],
    media: [],
    drawings: [],
    signatures: [],
  } as unknown as PdfReport;
  const html = renderWithCustomPages(report, new Map(), me);
  expect(html).not.toContain('UNUSED PAGE');
  const page = await browser.newPage();
  try {
    await page.setContent(evsDocumentHtml(html, false));
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(paginateEvs);
    expect(await page.$eval('body', (body) => body.textContent)).toContain('D'.repeat(500));
    const overflow = await page.$$eval('.custom-report-sheet', (sheets) =>
      sheets.map((s) => {
        const flow = s.querySelector('.evs-flow')!.getBoundingClientRect();
        const heading = s.querySelector('.evs-heading')!,
          text = heading.querySelector('span')!;
        return {
          flow: Math.max(
            ...[...s.querySelector('.evs-flow')!.children].map(
              (e) => e.getBoundingClientRect().bottom - flow.bottom,
            ),
          ),
          title: text.getBoundingClientRect().height - heading.clientHeight,
        };
      }),
    );
    overflow.forEach((o) => {
      expect(o.flow).toBeLessThanOrEqual(1);
      expect(o.title).toBeLessThanOrEqual(0);
    });
  } finally {
    await page.close();
  }
});
it.each(reportTypeCodes.flatMap((code) => [1, 2, 3, 4, 6].map((capacity) => ({ code, capacity }))))(
  'paginates $code with $capacity photos per custom sheet and keeps normal attachments separate',
  async ({ code, capacity }) => {
    const page = customReportPageSchema.parse({
      id: 'photo-page',
      kind: 'photos',
      title: 'FOTOS EXTRAS',
      photosPerPage: capacity,
      position: 'afterIdentification',
    });
    const draw = customReportPageSchema.parse({
      id: 'drawing-page',
      kind: 'drawing',
      title: 'DESENHO EXTRA',
      drawings: [
        {
          data: {
            ...newDrawingData(),
            notes: 'PRIVATE NOTE',
            elements: [
              { id: 'point', type: 'point', reportPointId: 'point-1', x: 200, y: 200 },
              {
                id: 'image',
                type: 'image',
                mediaKey: 'drawing-image-extra',
                x: 500,
                y: 400,
                width: 300,
                height: 240,
                rotation: 0,
              },
            ],
          },
        },
      ],
      points: [{ key: 'point-1', number: '9' }],
    });
    const points = customReportPageSchema.parse({
      id: 'points-page',
      kind: 'points',
      title: 'PONTOS EXTRAS',
      points: [{ key: 'p', number: '01 - 04', reading: '5,9 mm', acceptable: false }],
    });
    const media = Array.from({ length: capacity + 1 }, (_, i) => ({
      id: 'photo-' + i,
      clientUploadId: customPhotoPrefix(page.id) + i,
      reportPointId: null,
      sectionKey: 'test-photos',
      mimeType: 'image/png',
      originalName: 'foto.png',
    }));
    media.push({
      id: 'background',
      clientUploadId: 'drawing-image-extra',
      reportPointId: null,
      sectionKey: 'drawing',
      mimeType: 'image/png',
      originalName: 'background.png',
    });
    const report = {
      number: '001',
      title: 'EQUIPAMENTO',
      reportDate: '2026-11-17',
      reportType: { code },
      company: { name: 'CLIENTE' },
      project: { name: 'OBRA' },
      points: [],
      drawings: [],
      signatures: [],
      media,
      specificData: { customPages: [page, draw, points] },
    } as unknown as PdfReport;
    const images = new Map(
      media.map((m, i) => [
        m.id,
        'data:image/svg+xml;base64,' +
          Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="400"><rect width="500" height="400" fill="#c4d4e8"/><text x="150" y="200" font-size="40">FOTO ${i + 1}</text></svg>`,
          ).toString('base64'),
      ]),
    );
    const before = structuredClone(report);
    const html = renderWithCustomPages(reportForPdf(report), images, templates[code]);
    expect(report).toEqual(before);
    expect(html).not.toContain('PRIVATE NOTE');
    for (const m of media.slice(0, -1)) expect(html.split(images.get(m.id)!).length - 1).toBe(1);
    const browserPage = await browser.newPage();
    try {
      await browserPage.setViewport({ width: 850, height: 1250 });
      await browserPage.setContent(evsDocumentHtml(html, false));
      await browserPage.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map((i) => i.decode()));
      });
      await browserPage.evaluate(paginateEvs);
      const photoSheets = await browserPage.$$eval('.custom-photo-sheet', (sheets) =>
        sheets.map((s) => ({
          title: s.querySelector('.evs-heading')!.textContent,
          count: s.querySelectorAll('img').length - 1,
          overflow:
            s.querySelector('.custom-photo-grid')!.getBoundingClientRect().bottom -
            s.querySelector('.evs-flow')!.getBoundingClientRect().bottom,
        })),
      );
      const extraPhotos = photoSheets.filter((s) => s.title === 'FOTOS EXTRAS');
      expect(extraPhotos.map((s) => s.count)).toEqual([capacity, 1]);
      photoSheets.forEach((s) => expect(s.overflow).toBeLessThanOrEqual(1));
      expect(
        await browserPage.$eval('.custom-drawing svg', (svg) =>
          svg.querySelector('circle')?.getAttribute('fill'),
        ),
      ).toBe('#1764C0');
      const headings = await browserPage.$$eval('.evs-heading', (h) => h.map((e) => e.textContent));
      expect(headings.indexOf('DESENHO EXTRA')).toBeLessThan(headings.indexOf('PONTOS EXTRAS'));
      if (code !== 'RDO')
        expect(headings.indexOf('PONTOS EXTRAS')).toBeLessThan(headings.indexOf('LAUDO FINAL'));
      if (code === 'LP' && capacity === 6) {
        const directory = fileURLToPath(
          new URL('../../../../artifacts/custom-pages', import.meta.url),
        );
        await mkdir(directory, { recursive: true });
        await (await browserPage.$('.custom-photo-sheet'))!.screenshot({
          path: directory + '/six-photos.png',
        });
        await (await browserPage.$('.custom-drawing-sheet'))!.screenshot({
          path: directory + '/drawing.png',
        });
      }
    } finally {
      await browserPage.close();
    }
  },
);

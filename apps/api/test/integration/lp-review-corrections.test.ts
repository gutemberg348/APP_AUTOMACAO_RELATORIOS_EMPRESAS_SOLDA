import { afterAll, beforeAll, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import puppeteer, { type Browser } from 'puppeteer-core';
import { newDrawingData, drawingSvg } from '@weldcosta/shared';
import { render } from '../../src/modules/pdf/templates/reports/lp';
import { identification } from '../../src/modules/pdf/templates/reports/reference-layout';
import { evsDocumentHtml, render as evs } from '../../src/modules/pdf/templates/reports/evs';
import { render as hydrostatic } from '../../src/modules/pdf/templates/reports/hydrostatic';
import { render as thickness } from '../../src/modules/pdf/templates/reports/thickness';
import { render as rdo } from '../../src/modules/pdf/templates/reports/rdo';
import { reportBody } from '../../src/modules/pdf/templates/reports/layout';
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

const fixture = () =>
  ({
    number: '001',
    title: 'Título automático antigo',
    reportDate: '2026-11-09',
    reportType: { code: 'LP' },
    company: { name: 'CLIENTE' },
    project: { name: 'OBRA' },
    signatures: [],
    media: [],
    specificData: {
      inspectionArea: 'VAPOR XXXXX',
      client: 'CLIENTE',
      factory: 'FÁBRICA',
      owner: 'PROPRIETÁRIO',
      work: 'OBRA',
      project: '2026',
      inspectionType: 'LÍQUIDO PENETRANTE',
      generalData: {
        temperature: '23',
        thickness: '3,91MM E 5,49MM',
        surfaceCondition: 'ESCOVADO',
        lightingIntensity: '1200 LUX',
        baseMetal: 'AÇO CARBONO SCH 40',
      },
      penetrantType: 'COLORIDO_TIPO_II',
      removalTechnique: 'AGUA',
      materials: {
        penetrant: {
          manufacturer: 'METAL CHEK DO BRASIL',
          brand: 'VP30',
          lot: 'LT-25-0916',
          expirationDate: '2027-09-30',
        },
      },
      discontinuities: [{ description: 'SEM INDICAÇÃO', code: 'A' }],
      finalReport: 'AS SOLDAS INSPECIONADAS ESTÃO APROVADAS.',
      finalResult: 'APPROVED',
    },
    points: [
      { id: 'p1', number: '01', data: { acceptable: true } },
      { id: 'p2', number: '02', data: { acceptable: false } },
    ],
    drawings: [
      {
        data: {
          ...newDrawingData(),
          elements: [
            { id: 'one', type: 'point', reportPointId: 'p1', x: 200, y: 200 },
            { id: 'two', type: 'point', reportPointId: 'p2', x: 400, y: 200 },
            { id: 'three', type: 'marker', number: '03', acceptable: true, x: 600, y: 200 },
            { id: 'four', type: 'marker', number: '04', x: 800, y: 200 },
          ],
        },
      },
    ],
  }) as unknown as PdfReport;

it('spreads TH identification across the sheet and paginates long values without overflow', async () => {
  const report = fixture();
  report.reportType.code = 'TH';
  report.title = 'COLETOR DE VAPOR';
  report.specificData = {
    owner: 'OCS',
    work: 'OCS',
    project: '071016',
    referenceDrawing: 'XXXXXXXX',
    materialStandard: 'ASTM',
    procedureRevision: 'REV-00',
    artNumber: '123456789',
    referenceStandard: 'ASME',
  };
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 850, height: 1200 });
    for (const long of [false, true]) {
      if (long)
        report.specificData = {
          ...(report.specificData as object),
          referenceStandard: 'NORMA EXTENSA '.repeat(350) + 'FIM DA NORMA',
        };
      await page.setContent(evsDocumentHtml(hydrostatic(report, new Map()), false));
      await page.evaluate(paginateEvs);
      const sheets = await page.$$eval('.th-identification .evs-flow', (nodes) =>
        nodes.map((flow) => ({
          gap: parseFloat(getComputedStyle(flow).gap),
          bottom: flow.getBoundingClientRect().bottom,
          last: flow.lastElementChild!.getBoundingClientRect().bottom,
        })),
      );
      expect(sheets.every((s) => s.last <= s.bottom + 1)).toBe(true);
      if (long) {
        expect(sheets.length).toBeGreaterThan(1);
        expect(await page.$eval('body', (e) => e.textContent)).toContain('FIM DA NORMA');
      } else {
        expect(sheets).toHaveLength(1);
        expect(sheets[0]!.gap).toBeGreaterThan(15);
        const folder = fileURLToPath(new URL('../../../../artifacts/lp-review/', import.meta.url));
        await mkdir(folder, { recursive: true });
        await (await page.$('.th-identification'))!.screenshot({
          path: folder + 'updated-th-identification.png',
        });
      }
    }
  } finally {
    await page.close();
  }
});

it('uses the LP inspected line as title, falls back for old blank fields, and leaves other types alone', () => {
  const report = fixture();
  expect(identification(report, [])).toContain('evs-data-title">VAPOR XXXXX</h1>');
  report.specificData = { inspectionArea: '  ' };
  expect(identification(report, [])).toContain('evs-data-title">Título automático antigo</h1>');
  report.title = '';
  expect(identification(report, [])).toContain('evs-data-title">OBRA</h1>');
  report.reportType.code = 'TH';
  report.specificData = { inspectionArea: 'NÃO USAR' };
  expect(identification(report, [])).not.toContain('NÃO USAR');
});

it('prints LP body black and all drawing points blue, retaining header blue, results and positions', async () => {
  const report = fixture(),
    original = structuredClone(report);
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 850, height: 1200 });
    await page.setContent(evsDocumentHtml(render(report, new Map()), false));
    await page.evaluate(paginateEvs);
    expect(await page.$eval('.evs-data-title', (e) => e.textContent)).toBe('VAPOR XXXXX');
    expect(await page.$eval('.lp-inspection-area', (e) => e.textContent)).toBe('VAPOR XXXXX');
    const colors = await page.$$eval('.lp-form-table td,.evs-contact', (nodes) =>
      nodes.map((e) => getComputedStyle(e).color),
    );
    expect(new Set(colors)).toEqual(new Set(['rgb(17, 17, 17)']));
    expect(await page.$eval('.evs-header td+td', (e) => getComputedStyle(e).color)).toBe(
      'rgb(36, 90, 161)',
    );
    const circles = await page.$$eval('.evs-drawing circle', (nodes) =>
      nodes.map((e) => e.getAttribute('fill')),
    );
    expect(circles).toEqual(Array(4).fill('#1764C0'));
    expect(
      await page.$$eval('.evs-drawing text', (nodes) => nodes.map((e) => e.getAttribute('fill'))),
    ).toEqual(Array(4).fill('#1764C0'));
    expect(report).toEqual(original);
    // The shared editor retains status colors by default.
    expect(drawingSvg(report.drawings[0]!.data as never, report.points as never)).toContain(
      '#16725B',
    );
    expect(drawingSvg(report.drawings[0]!.data as never, report.points as never)).toContain(
      '#AF302B',
    );
    const folder = fileURLToPath(new URL('../../../../artifacts/lp-review/', import.meta.url));
    await mkdir(folder, { recursive: true });
    for (const [selector, name] of [
      ['.evs-identification', 'identification'],
      ['.lp-technical', 'technical'],
      ['.evs-drawing', 'drawing'],
    ]) {
      await (await page.$(selector!))!.screenshot({ path: folder + 'updated-' + name + '.png' });
    }
  } finally {
    await page.close();
  }
});

it.each([
  ['EVS', evs],
  ['EVD', evs],
  ['LP', render],
  ['TH', hydrostatic],
  ['ME', thickness],
  ['RDO', rdo],
  ['EVS', (report: PdfReport) => reportBody(report, new Map(), 'EVS')],
] as const)(
  'prints blue drawing points in %s, regardless of inspection result',
  async (code, renderer) => {
    const report = fixture();
    report.reportType.code = code;
    const original = structuredClone(report);
    const page = await browser.newPage();
    try {
      await page.setContent(renderer(report, new Map()));
      const colors = await page.$$eval(
        '.evs-drawing circle,.rdo-drawing circle,.cad-canvas circle',
        (nodes) => nodes.map((node) => node.getAttribute('fill')),
      );
      // TH and ME deliberately omit drawing pages.
      expect(colors).toEqual(['TH', 'ME'].includes(code) ? [] : Array(4).fill('#1764C0'));
      const labels = await page.$$eval(
        '.evs-drawing text,.rdo-drawing text,.cad-canvas text',
        (nodes) => nodes.map((node) => node.getAttribute('fill')),
      );
      expect(labels).toEqual(colors);
      expect(report).toEqual(original);
    } finally {
      await page.close();
    }
  },
);

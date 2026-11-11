import { afterAll, beforeAll, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer, { type Browser } from 'puppeteer-core';
import { render, evsDocumentHtml } from '../../src/modules/pdf/templates/reports/evs';
import { paginateEvs } from '../../src/modules/pdf/templates/reports/evs/paginate';
import type { PdfReport } from '../../src/modules/pdf/templates/reports/layout';
import { render as renderLp } from '../../src/modules/pdf/templates/reports/lp';
import { newDrawingData, drawingSvg, drawingPageBounds } from '@weldcosta/shared';

let browser: Browser;
beforeAll(async () => {
  const executablePath = [
    process.env.PDF_CHROME_EXECUTABLE,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
  ].find((file) => file && existsSync(file));
  browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: process.env.PDF_DISABLE_SANDBOX === 'true' ? ['--no-sandbox'] : [],
  });
});
afterAll(async () => browser?.close());

it('keeps a full-page image at the borders and handles an empty drawing', async () => {
  const data = { ...newDrawingData(), page: 'portrait' as const };
  const bounds = drawingPageBounds(data);
  const image = {
    id: 'image',
    type: 'image' as const,
    mediaKey: 'photo',
    x: 500,
    y: 400,
    width: bounds.width,
    height: bounds.height,
    rotation: 0,
  };
  const page = await browser.newPage();
  try {
    await page.setContent(
      drawingSvg({ ...data, elements: [image] }, [], {
        centerContent: true,
        images: {
          photo:
            'data:image/svg+xml,' +
            encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="blue"/></svg>',
            ),
        },
      }) + drawingSvg(data, [], { centerContent: true }),
    );
    await page.evaluate(paginateEvs);
    const transforms = await page.$$eval('[data-print-drawing-content]', (nodes) =>
      nodes.map((node) => node.getAttribute('transform')),
    );
    expect(transforms[0]).toContain('scale(1)');
    expect(transforms[1]).toBeNull();
    expect(transforms.join('')).not.toContain('NaN');
  } finally {
    await page.close();
  }
});

for (const code of ['EVS', 'LP']) {
  it(`${code} centers drawings including number labels and contains long header numbers`, async () => {
    const report = {
      number: 'LINHA DEGUSTAÇÃO',
      title: 'QA',
      reportDate: '2026-11-11',
      reportType: { code },
      company: { name: 'Empresa' },
      project: { name: 'Obra' },
      specificData: {},
      signatures: [],
      media: [],
      points: [{ id: 'p1', number: '01', data: { acceptable: true } }],
      drawings: [
        {
          data: {
            ...newDrawingData(),
            page: 'portrait',
            elements: [
              { id: 'pipe', type: 'line', x1: 200, y1: 150, x2: 480, y2: 350 },
              { id: 'text', type: 'text', x: 210, y: 125, text: 'SAÍDA DA LINHA', size: 20 },
              {
                id: 'mark',
                type: 'point',
                reportPointId: 'p1',
                x: 350,
                y: 257,
                labelPosition: 'custom',
                labelX: 335,
                labelY: 230,
              },
            ],
          },
        },
      ],
    } as unknown as PdfReport;
    const before = structuredClone(report);
    const page = await browser.newPage();
    try {
      await page.setContent(
        evsDocumentHtml((code === 'LP' ? renderLp : render)(report, new Map()), false),
      );
      await page.evaluate(paginateEvs);
      const geometry = await page.evaluate(() => {
        const content = document.querySelector<SVGGElement>('[data-print-drawing-content]')!;
        const svg = content.ownerSVGElement!;
        const r = content.getBoundingClientRect(),
          frame = svg.getBoundingClientRect();
        return {
          dx: (r.left + r.right - frame.left - frame.right) / 2,
          dy: (r.top + r.bottom - frame.top - frame.bottom) / 2,
          headers: [...document.querySelectorAll<HTMLElement>('.evs-report-number')].every(
            (cell) => {
              const text = cell.querySelector('span')!.getBoundingClientRect(),
                box = cell.getBoundingClientRect();
              return (
                text.top >= box.top &&
                text.bottom <= box.bottom &&
                text.left >= box.left &&
                text.right <= box.right
              );
            },
          ),
          insideHeaders: [...document.querySelectorAll('.evs-header')].every(
            (header) =>
              header.querySelector('table')!.getBoundingClientRect().bottom <=
              header.getBoundingClientRect().bottom + 1,
          ),
          labels: [...content.querySelectorAll('text')].map((text) => text.textContent),
        };
      });
      expect(geometry.dx).toBeCloseTo(0, 1);
      expect(geometry.dy).toBeCloseTo(0, 1);
      expect(geometry.headers).toBe(true);
      expect(geometry.insideHeaders).toBe(true);
      expect(geometry.labels).toEqual(['SAÍDA DA LINHA', '01']);
      expect(report).toEqual(before);
      if (code === 'EVS') {
        const artifacts = fileURLToPath(
          new URL('../../../../artifacts/evs-photo-pagination/', import.meta.url),
        );
        await mkdir(artifacts, { recursive: true });
        const sheet = await page
          .$('.evs-drawing')
          .then((element) => element?.evaluateHandle((node) => node.closest('article')));
        await sheet
          ?.asElement()
          ?.screenshot({ path: path.join(artifacts, 'centered-drawing-header.png') });
      }
      // Maximum allowed number remains fully inside the same header row.
      await page.$$eval('.evs-report-number>span', (nodes) =>
        nodes.forEach((node) => (node.textContent = 'LINHA DE PROCESSO '.repeat(6).slice(0, 100))),
      );
      await page.evaluate(paginateEvs);
      expect(
        await page.$$eval('.evs-report-number', (cells) =>
          cells.every((cell) => {
            const text = cell.querySelector('span')!.getBoundingClientRect(),
              box = cell.getBoundingClientRect();
            return text.top >= box.top && text.bottom <= box.bottom;
          }),
        ),
      ).toBe(true);
    } finally {
      await page.close();
    }
  });
}

for (const code of ['EVS', 'EVD']) {
  for (const count of [3, 7]) {
    it(`${code} fits three pairs per sheet including saved labels, notes and photo captions (${count} pairs)`, async () => {
      const image =
        'data:image/svg+xml,' +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="200"><rect width="100" height="200" fill="#277b91"/></svg>',
        );
      const report = {
        number: '001',
        title: 'INSPEÇÃO QA',
        reportDate: '2026-11-11',
        reportType: { code },
        project: { name: 'Obra' },
        company: { name: 'Empresa' },
        specificData: {},
        drawings: [],
        signatures: [],
        points: Array.from({ length: count }, (_, i) => ({
          id: 'p' + i,
          number: String(i + 1),
          label: 'TUBULAÇÃO DE PROCESSO',
          data: {
            dimension: '2 polegadas',
            discontinuity: '-',
            acceptable: true,
            notes: 'REGISTRO DO PONTO ' + (i + 1),
          },
        })),
        media: Array.from({ length: count * 2 }, (_, i) => ({
          id: 'm' + i,
          reportPointId: 'p' + Math.floor(i / 2),
          sectionKey: 'photos',
          caption: 'VISTA DA SOLDA ' + i,
        })),
      } as unknown as PdfReport;
      const page = await browser.newPage();
      try {
        await page.setContent(
          evsDocumentHtml(
            render(report, new Map(report.media.map((media) => [media.id, image]))),
            false,
          ),
        );
        await page.evaluate(paginateEvs);
        const result = await page.evaluate(() => {
          const sheets = [...document.querySelectorAll('.evs-sheet')].filter((sheet) =>
            sheet.querySelector('.evs-weld'),
          );
          return {
            rows: sheets.map((sheet) => sheet.querySelectorAll('.evs-weld').length),
            overflow: sheets.some((sheet) =>
              [...sheet.querySelector('.evs-flow')!.children].some(
                (block) =>
                  block.getBoundingClientRect().bottom >
                  sheet.querySelector('.evs-flow')!.getBoundingClientRect().bottom + 1,
              ),
            ),
            photos: [...document.querySelectorAll('.evs-photo-pair img')].filter(
              (img) => (img as HTMLImageElement).naturalWidth > 0,
            ).length,
            text: document.body.textContent,
          };
        });
        expect(result.rows).toEqual(count === 3 ? [3] : [3, 3, 1]);
        expect(result.photos).toBe(count * 2);
        expect(result.overflow).toBe(false);
        for (let i = 0; i < count; i++)
          expect(result.text).toContain('REGISTRO DO PONTO ' + (i + 1));
        for (let i = 0; i < count * 2; i++) expect(result.text).toContain('VISTA DA SOLDA ' + i);
        if (code === 'EVS' && count === 3) {
          const artifacts = fileURLToPath(
            new URL('../../../../artifacts/evs-photo-pagination/', import.meta.url),
          );
          await mkdir(artifacts, { recursive: true });
          const sheet = await page
            .$('.evs-weld')
            .then((element) => element?.evaluateHandle((node) => node.closest('article')));
          await sheet?.asElement()?.screenshot({
            path: path.join(artifacts, 'three-pairs.png'),
          });
        }
      } finally {
        await page.close();
      }
    });
  }
}

import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
import { newDrawingData, removePointFromDrawings } from '@weldcosta/shared';
import { render as EVS, evsDocumentHtml } from '../apps/api/src/modules/pdf/templates/reports/evs';
import { render as LP } from '../apps/api/src/modules/pdf/templates/reports/lp';
import { render as TH } from '../apps/api/src/modules/pdf/templates/reports/hydrostatic';
import { render as ME } from '../apps/api/src/modules/pdf/templates/reports/thickness';
import { render as RDO } from '../apps/api/src/modules/pdf/templates/reports/rdo';
import { paginateEvs } from '../apps/api/src/modules/pdf/templates/reports/evs/paginate';
import type { PdfReport } from '../apps/api/src/modules/pdf/templates/reports/layout';

async function main() {
  const output = resolve('docs/verificacao');
  await mkdir(output, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    for (const [code, render] of Object.entries({ EVS, LP, TH, ME, RDO })) {
      const report = {
        id: 'drawing-points-check',
        number: 'TESTE-002',
        title: 'Verificação de pontos no desenho',
        reportDate: new Date('2026-10-11'),
        reportType: { code },
        company: { name: 'Empresa de demonstração' },
        project: { name: 'Obra de demonstração' },
        specificData: {
          client: 'Cliente de demonstração',
          finalReport: 'Documento de teste. Dados fictícios.',
          finalResult: 'APPROVED',
        },
        points: [
          { id: 'saved-point-a', number: 'S-701', data: { acceptable: true }, value: null },
          { id: 'saved-point-b', number: 'S-702', data: { acceptable: false }, value: null },
        ],
        drawings: [
          {
            id: 'saved-drawing',
            data: {
              ...newDrawingData(),
              title: 'Desenho 01',
              elements: [
                { id: 'line', type: 'line', x1: 120, y1: 200, x2: 800, y2: 590 },
                { id: 'a', type: 'point', reportPointId: 'saved-point-a', x: 350, y: 330 },
                { id: 'b', type: 'point', reportPointId: 'saved-point-b', x: 650, y: 500 },
              ],
            },
          },
        ],
        media: [],
        signatures: [],
      } as unknown as PdfReport;
      report.drawings = removePointFromDrawings(
        report.drawings,
        report.points[0]!,
        true,
      ) as typeof report.drawings;
      report.points = report.points.slice(1);
      await page.setContent(evsDocumentHtml(render(report, new Map()), false), {
        waitUntil: 'load',
      });
      await page.evaluate(paginateEvs);
      const markers = await page.$$eval('.evs-drawing svg text,.rdo-drawing svg text', (elements) =>
        elements.map((element) => {
          const box = element.getBoundingClientRect();
          const parent = element.closest('svg')!.getBoundingClientRect();
          return {
            text: element.textContent,
            visible:
              box.width > 0 &&
              box.height > 0 &&
              box.top >= parent.top &&
              box.bottom <= parent.bottom &&
              box.left >= parent.left &&
              box.right <= parent.right,
          };
        }),
      );
      assert.deepEqual(
        markers.map((m) => m.text),
        ['S-701', 'S-702'],
        code,
      );
      assert.ok(
        markers.every((m) => m.visible),
        code + ' numbered markers visible inside canvas',
      );
      await writeFile(
        resolve(output, `pontos-desenho-${code}.pdf`),
        await page.pdf({
          format: 'A4',
          printBackground: true,
          preferCSSPageSize: true,
          margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
        }),
      );
      const drawing = await page.$('.evs-drawing,.rdo-drawing');
      await drawing!.screenshot({ path: resolve(output, `pontos-desenho-${code}.png`) });
      console.log(code + ': both saved markers visible and numbered after pagination/export');
    }
  } finally {
    await browser.close();
  }
}
void main();

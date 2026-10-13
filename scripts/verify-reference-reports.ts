import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
import { newDrawingData, reportSections } from '@weldcosta/shared';
import { evsDocumentHtml } from '../apps/api/src/modules/pdf/templates/reports/evs';
import { paginateEvs } from '../apps/api/src/modules/pdf/templates/reports/evs/paginate';
import { render as lp } from '../apps/api/src/modules/pdf/templates/reports/lp';
import { render as th } from '../apps/api/src/modules/pdf/templates/reports/hydrostatic';
import { render as me } from '../apps/api/src/modules/pdf/templates/reports/thickness';
import { render as rdo } from '../apps/api/src/modules/pdf/templates/reports/rdo';
import type { PdfReport } from '../apps/api/src/modules/pdf/templates/reports/layout';

const renderers = { LP: lp, TH: th, ME: me, RDO: rdo };
function set(data: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split('.');
  let target = data;
  for (const key of keys.slice(0, -1)) {
    target[key] ??= {};
    target = target[key] as Record<string, unknown>;
  }
  target[keys.at(-1)!] = value;
}
async function main() {
  const output = resolve('docs/verificacao');
  await mkdir(output, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath:
      process.env.PDF_CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    for (const [code, render] of Object.entries(renderers)) {
      const data: Record<string, unknown> = {};
      const markers: string[] = [];
      for (const field of reportSections[code]!.flatMap((s) => s.fields)) {
        const marker = 'TESTE-' + field.path.replaceAll('.', '-');
        const value =
          field.kind === 'date' ? '2026-10-10' : field.kind === 'result' ? 'APPROVED' : marker;
        if (!field.kind || field.kind === 'long') markers.push(marker);
        set(data, field.path, value);
      }
      const points =
        code === 'LP'
          ? [
              { id: 'p0', number: '01', label: '', data: { acceptable: true }, value: null },
              { id: 'p1', number: '02', label: '', data: { acceptable: false }, value: null },
            ]
          : code === 'ME'
            ? Array.from({ length: 9 }, (_, i) => ({
                id: 'p' + i,
                number: String(i + 1),
                label: i < 5 ? 'LADO A' : 'LADO B',
                value: 5.9 + (i % 2) / 10,
                unit: 'mm',
                data: { acceptable: true },
              }))
            : [];
      const count = code === 'RDO' ? 1 : code === 'ME' ? 4 : 6;
      const media = Array.from({ length: count }, (_, i) => ({
        id: 'm' + i,
        reportPointId:
          code === 'LP' && i < 4 ? 'p' + (i % 2) : code === 'ME' ? 'p' + (i < 2 ? 0 : 5) : null,
        sectionKey: 'photos',
        caption: '',
      }));
      const report = {
        id: 'test',
        number: '001',
        title: 'EQUIPAMENTO DE VERIFICAÇÃO',
        reportDate: new Date('2026-10-10'),
        reportType: { code },
        project: { name: 'Obra de verificação' },
        specificData: data,
        points,
        media,
        drawings:
          code === 'LP'
            ? [
                {
                  data: {
                    ...newDrawingData(),
                    title: 'Desenho de verificação',
                    elements: [{ id: 'line', type: 'line', x1: 100, y1: 300, x2: 800, y2: 500 }],
                  },
                },
              ]
            : [],
        signatures:
          code === 'RDO'
            ? []
            : [
                {
                  id: 's1',
                  role: 'INSPECTOR',
                  name: 'Inspetor de teste',
                  registrationNumber: 'REG-TESTE',
                  signedAt: new Date('2026-10-10'),
                },
                {
                  id: 's2',
                  role: 'TECHNICAL_RESPONSIBLE',
                  name: 'Responsável de teste',
                  registrationNumber: 'REG-TESTE-2',
                  signedAt: new Date('2026-10-10'),
                },
              ],
      } as unknown as PdfReport;
      const images = new Map(
        media.map((m, i) => [
          m.id,
          'data:image/svg+xml;base64,' +
            Buffer.from(
              `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="280"><rect width="400" height="280" fill="${i % 2 ? '#dae8ed' : '#ecedef'}"/><circle cx="200" cy="120" r="70" stroke="#708390" stroke-width="18" fill="none"/><text x="200" y="240" text-anchor="middle" font-size="20">FOTO DE TESTE ${i + 1}</text></svg>`,
            ).toString('base64'),
        ]),
      );
      await page.setContent(evsDocumentHtml(render(report, images), false), { waitUntil: 'load' });
      await page.evaluate(paginateEvs);
      const audit = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.evs-sheet')).map((sheet) => ({
          title: sheet.querySelector('.evs-heading')!.textContent,
          number: sheet.querySelector('.evs-page-number')!.textContent,
          images: sheet.querySelectorAll('main img').length,
          signers: sheet.querySelectorAll('.evs-signer').length,
        })),
      );
      const text = await page.$eval('body', (body) => body.textContent!);
      assert.equal(
        audit.length,
        { LP: 6, TH: 5, ME: 4, RDO: 1 }[code],
        code + ' reference pagination',
      );
      for (const marker of markers)
        assert.ok(text.includes(marker), code + ' missing field ' + marker);
      assert.equal(
        audit.reduce((n, p) => n + p.images, 0),
        count,
        code + ' photo count',
      );
      assert.equal(
        audit.reduce((n, p) => n + p.signers, 0),
        code === 'RDO' ? 0 : 3,
      );
      audit.forEach((p, i) =>
        assert.equal(
          p.number,
          String(i + 1).padStart(2, '0') + '/' + String(audit.length).padStart(2, '0'),
        ),
      );
      const bytes = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
      });
      await writeFile(resolve(output, `report-${code}-modelo-verificado.pdf`), bytes);
      for (const [i, sheet] of (await page.$$('.evs-sheet')).entries())
        await sheet.screenshot({
          path: resolve(output, `report-${code}-modelo-pagina-${i + 1}.png`),
        });
      console.log(code + ' ' + JSON.stringify(audit));
      set(
        data,
        code === 'TH' || code === 'RDO' ? 'observation' : 'finalReport',
        'Texto extenso de verificação. '.repeat(300) + 'FIM-LAUDO',
      );
      set(
        data,
        code === 'RDO' ? 'work' : 'owner',
        'Identificação extensa. '.repeat(300) + 'FIM-IDENTIFICACAO',
      );
      media[0]!.caption = 'Legenda longa. '.repeat(120) + 'FIM-LEGENDA';
      await page.setContent(evsDocumentHtml(render(report, images), false), { waitUntil: 'load' });
      await page.evaluate(paginateEvs);
      const longText = await page.$eval('body', (body) => body.textContent!);
      for (const end of ['FIM-LAUDO', 'FIM-IDENTIFICACAO', 'FIM-LEGENDA'])
        assert.ok(longText.includes(end), code + ' lost ' + end);
      console.log(code + ' long fields preserved');
    }
  } finally {
    await browser.close();
  }
}
void main();

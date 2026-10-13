import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
import { render, evsDocumentHtml } from '../apps/api/src/modules/pdf/templates/reports/evs';
import { paginateEvs } from '../apps/api/src/modules/pdf/templates/reports/evs/paginate';
import type { PdfReport } from '../apps/api/src/modules/pdf/templates/reports/layout';

async function main() {
  const output = resolve('docs/verificacao');
  await mkdir(output, { recursive: true });
  const report = {
    id: 'test',
    number: '026',
    title: 'LINHA RETORNO DE CIP',
    reportDate: new Date('2026-10-10'),
    project: { name: 'Obra de verificação' },
    reportType: { code: 'EVS' },
    drawings: [],
    specificData: {
      client: 'CLIENTE DE VERIFICAÇÃO',
      factory: 'FÁBRICA DE VERIFICAÇÃO',
      owner: 'Proprietário de verificação',
      work: 'Maceió – AL',
      project: '0010-0007',
      procedureRevision: 'PR-VT-01 / REV-0',
      inspectionType: 'EVS REMOTO',
      weldingProcess: 'TIG MANUAL',
      baseMetal: 'AÇO INOX 316',
      bevel: 'RETO',
      purgeGas: 'NITROGÊNIO',
      acceptanceCriteria: 'Critério informado',
      referenceStandard: 'Norma informada',
      finalReport: 'Texto de conclusão de verificação. Os resultados abaixo são fictícios.',
      finalResult: 'APPROVED',
    },
    signatures: [
      {
        id: 's1',
        role: 'INSPECTOR',
        name: 'Inspetor de verificação',
        registrationNumber: 'Registro de teste',
        signedAt: new Date('2026-10-10'),
      },
      {
        id: 's2',
        role: 'TECHNICAL_RESPONSIBLE',
        name: 'Responsável de verificação',
        registrationNumber: 'Registro de teste',
        signedAt: new Date('2026-10-10'),
      },
    ],
    points: Array.from({ length: 9 }, (_, i) => ({
      id: 'p' + i,
      number: String(i + 1),
      data: { dimension: '4"', discontinuity: '-', acceptable: true },
      value: null,
    })),
    media: Array.from({ length: 18 }, (_, i) => ({
      id: 'm' + i,
      reportPointId: 'p' + Math.floor(i / 2),
      sectionKey: 'photos',
      caption: '',
    })),
  } as unknown as PdfReport;
  const images = new Map(
    report.media.map((m, i) => [
      m.id,
      'data:image/svg+xml;base64,' +
        Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="450" height="270"><rect width="450" height="270" fill="${i % 2 ? '#dae8ed' : '#ecedef'}"/><circle cx="225" cy="135" r="90" fill="none" stroke="#708390" stroke-width="25"/><text x="225" y="140" text-anchor="middle" font-size="20">FOTO DE TESTE ${i + 1}</text></svg>`,
        ).toString('base64'),
    ]),
  );
  const browser = await puppeteer.launch({
    executablePath:
      process.env.PDF_CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setContent(evsDocumentHtml(render(report, images), false), { waitUntil: 'load' });
    await page.evaluate(paginateEvs);
    const audit = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.evs-sheet')).map((sheet) => ({
        title: sheet.querySelector('.evs-heading')!.textContent,
        page: sheet.querySelector('.evs-page-number')!.textContent,
        welds: sheet.querySelectorAll('.evs-weld').length,
        images: sheet.querySelectorAll('.evs-photo-pair img').length,
        signers: sheet.querySelectorAll('.evs-signer').length,
      })),
    );
    assert.deepEqual(
      audit.filter((s) => s.title === 'SOLDA').map((s) => s.welds),
      [4, 4, 1],
    );
    assert.equal(audit.at(-1)!.signers, 3);
    assert.equal(audit.length, 6);
    assert.equal(audit.at(-1)!.page, '06/06');
    const typography = await page.$eval('.evs-sheet:nth-of-type(2)', (sheet) => ({
      heading: sheet.querySelector('.evs-heading')!.textContent!.replace(/\s+/g, ' ').trim(),
      title: sheet.querySelector('.evs-data-title')!.textContent,
      titleSize: getComputedStyle(sheet.querySelector('.evs-data-title')!).fontSize,
      bodySize: getComputedStyle(sheet.querySelector('.evs-data-line')!).fontSize,
    }));
    assert.equal(typography.title, 'LINHA RETORNO DE CIP');
    assert.ok(typography.heading.includes('RELATÓRIO DE ENSAIO'));
    assert.ok(typography.heading.includes('VISUAL DE SOLDAS'));
    assert.equal(typography.titleSize, '26px');
    assert.equal(typography.bodySize, '18px');
    const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    await writeFile(resolve(output, 'report-EVS-modelo-verificado.pdf'), pdf);
    for (const [i, sheet] of (await page.$$('.evs-sheet')).entries()) {
      if ([0, 1, 2, 5].includes(i))
        await sheet.screenshot({ path: resolve(output, `report-EVS-modelo-pagina-${i + 1}.png`) });
    }
    console.log(JSON.stringify(audit));
    const legacy = {
      ...report,
      title: report.project.name + ' · Ensaio Visual / Endoscopia',
      reportType: { ...report.reportType, name: 'Ensaio Visual / Endoscopia' },
    };
    await page.setContent(evsDocumentHtml(render(legacy, images), false), { waitUntil: 'load' });
    await page.evaluate(paginateEvs);
    assert.equal(
      await page.$eval('.evs-data-title', (element) => element.textContent),
      report.project.name,
    );
    legacy.title = 'ENDOSCOPIA DA LINHA PRINCIPAL';
    await page.setContent(evsDocumentHtml(render(legacy, images), false), { waitUntil: 'load' });
    assert.equal(
      await page.$eval('.evs-data-title', (element) => element.textContent),
      legacy.title,
    );
    console.log('Legacy automatic title removed from body; custom inspection title preserved');
    // Long fields/captions must continue on numbered pages without losing information.
    report.specificData = {
      ...(report.specificData as object),
      finalReport: 'Texto de verificação extenso. '.repeat(300) + 'FIM-LAUDO',
      owner: 'Proprietário extenso '.repeat(400) + 'FIM-PROPRIETARIO',
    };
    report.media[0]!.caption = 'Legenda extensa '.repeat(110) + 'FIM-LEGENDA';
    await page.setContent(evsDocumentHtml(render(report, images), false), { waitUntil: 'load' });
    await page.evaluate(paginateEvs);
    const text = await page.$eval('body', (body) => body.textContent!);
    for (const ending of ['FIM-LAUDO', 'FIM-PROPRIETARIO', 'FIM-LEGENDA'])
      assert.ok(text.includes(ending));
    console.log('Long fields and captions: passed');
  } finally {
    await browser.close();
  }
}
void main();

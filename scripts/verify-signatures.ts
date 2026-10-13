import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import puppeteer from 'puppeteer-core';
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
  const bytes = await sharp(
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="500"><path d="M80 300 L300 80 L190 390 L520 130 L430 350 L750 180 L900 290" fill="none" stroke="#153854" stroke-width="9"/></svg>',
    ),
  )
    .png()
    .toBuffer();
  const uri = 'data:image/png;base64,' + bytes.toString('base64');
  const browser = await puppeteer.launch({
    executablePath:
      process.env.PDF_CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    for (const [code, render] of Object.entries({ EVS, LP, TH, ME, RDO })) {
      const report = {
        id: 'signature-check',
        number: 'TESTE-001',
        title: 'Verificação de assinaturas',
        reportDate: new Date('2026-10-11'),
        reportType: { code },
        company: { name: 'Empresa de demonstração' },
        project: { name: 'Obra de demonstração' },
        specificData: {
          client: 'Cliente de demonstração',
          finalReport: 'Documento de teste de apresentação. Dados e traços fictícios.',
          observation: 'Verificação da assinatura no documento.',
          finalResult: 'APPROVED',
        },
        points: [],
        drawings: [],
        media: [],
        signatures: ['INSPECTOR', 'TECHNICAL_RESPONSIBLE', 'CLIENT'].map((role, index) => ({
          id: 's' + index,
          role,
          name: 'Pessoa de demonstração ' + (index + 1),
          registrationNumber: 'TESTE-00' + (index + 1),
          signedAt: new Date('2026-10-11'),
        })),
        signatureImages: { s0: uri, s1: uri, s2: uri },
      } as unknown as PdfReport;
      await page.setContent(evsDocumentHtml(render(report, new Map()), false), {
        waitUntil: 'load',
      });
      await page.evaluate(paginateEvs);
      const images = await page.$$eval('.evs-signature-space img', (elements) =>
        elements.map((el) => {
          const img = el as HTMLImageElement,
            bounds = img.getBoundingClientRect(),
            parent = img.parentElement!.getBoundingClientRect();
          return {
            loaded: img.complete && img.naturalWidth > 0,
            fits: bounds.height <= parent.height + 1 && bounds.width <= parent.width + 1,
          };
        }),
      );
      assert.equal(images.length, 3, code + ' includes every signature');
      assert.ok(
        images.every((i) => i.loaded && i.fits),
        code + ' signatures visible inside slots',
      );
      const pages = await page.$$('.evs-sheet');
      await writeFile(
        resolve(output, `assinaturas-${code}.pdf`),
        await page.pdf({
          format: 'A4',
          printBackground: true,
          preferCSSPageSize: true,
          margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
        }),
      );
      await pages.at(-1)!.screenshot({ path: resolve(output, `assinaturas-${code}-final.png`) });
      console.log(`${code}: ${pages.length} pages, 3 loaded signatures without overflow`);
    }
  } finally {
    await browser.close();
  }
}
void main();

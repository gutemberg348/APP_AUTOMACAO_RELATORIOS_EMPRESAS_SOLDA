import { randomUUID } from 'node:crypto';
import { reportCreateSchema, drawingDataSchema } from '@weldcosta/shared';
import { access } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import type { Report } from '../../generated/prisma/client';
import { prisma } from '../../prisma/client';
import { AppError } from '../../errors/app-error';
import { env } from '../../config/env';
import { LocalStorageProvider } from '../../services/storage/local-storage-provider';
import type { PdfReport } from './templates/reports/layout';
import { render as evs, evsDocumentHtml } from './templates/reports/evs';
import { paginateEvs } from './templates/reports/evs/paginate';
import { render as lp } from './templates/reports/lp';
import { render as hydrostatic } from './templates/reports/hydrostatic';
import { render as thickness } from './templates/reports/thickness';
import { render as rdo } from './templates/reports/rdo';
const renderers: Record<string, (report: PdfReport, images: Map<string, string>) => string> = {
  EVS: evs,
  LP: lp,
  TH: hydrostatic,
  ME: thickness,
  RDO: rdo,
};
export interface PdfProvider {
  generate(
    report: Report,
    generatedById: string,
  ): Promise<{ id: string; version: number; filePath: string }>;
  discard(filePath: string): Promise<void>;
}
export class PdfService implements PdfProvider {
  private storage = new LocalStorageProvider(env.STORAGE_PATH);
  private async snapshot(id: string) {
    const report = await prisma.report.findFirst({
      where: { id, deletedAt: null },
      include: {
        company: true,
        project: true,
        reportType: true,
        points: { orderBy: { sortOrder: 'asc' } },
        signatures: true,
        drawings: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
        media: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!report) throw new AppError(404, 'NOT_FOUND', 'Relatório não encontrado.');
    return report;
  }
  private async executable() {
    for (const file of [
      env.PDF_CHROME_EXECUTABLE,
      process.platform === 'win32'
        ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
        : '/usr/bin/chromium',
      '/usr/bin/google-chrome',
    ].filter(Boolean) as string[]) {
      try {
        await access(file);
        return file;
      } catch {
        /* Try the next supported location. */
      }
    }
    throw new AppError(
      503,
      'PDF_BROWSER_MISSING',
      'Chrome/Chromium não está disponível no servidor para gerar o PDF.',
    );
  }
  private async render(report: PdfReport, final: boolean) {
    reportCreateSchema.pick({ number: true }).parse(report);
    const template = renderers[report.reportType.code];
    if (!template)
      throw new AppError(
        422,
        'PDF_TEMPLATE_MISSING',
        'Este tipo ainda não possui template de PDF.',
      );
    const images = new Map<string, string>();
    const availableImages = new Set(
      report.media.filter((m) => m.sectionKey === 'drawing').map((m) => m.clientUploadId ?? m.id),
    );
    if (
      report.drawings.some((d) =>
        drawingDataSchema
          .parse(d.data)
          .elements.some((e) => e.type === 'image' && !availableImages.has(e.mediaKey)),
      )
    )
      throw new AppError(
        422,
        'DRAWING_IMAGE_PENDING',
        'Há imagens do desenho que ainda não foram enviadas. Salve o relatório e aguarde o envio antes de baixar o PDF.',
      );
    report.signatureImages = {};
    for (const signer of report.signatures) {
      if (signer.signatureImagePath)
        report.signatureImages[signer.id] =
          'data:image/png;base64,' +
          (await this.storage.get(signer.signatureImagePath)).toString('base64');
    }
    for (const media of report.media)
      images.set(
        media.id,
        'data:' +
          media.mimeType +
          ';base64,' +
          (await this.storage.get(media.filePath)).toString('base64'),
      );
    const browser = await puppeteer.launch({
      executablePath: await this.executable(),
      headless: true,
      args:
        env.PDF_DISABLE_SANDBOX === 'true'
          ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
          : [],
    });
    try {
      const page = await browser.newPage();
      await page.setJavaScriptEnabled(false);
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        void (/^(data:|about:)/.test(request.url()) ? request.continue() : request.abort());
      });
      await page.setContent(evsDocumentHtml(template(report, images), final), {
        waitUntil: 'load',
        timeout: 30000,
      });
      await page.evaluate(paginateEvs);
      return Buffer.from(
        await page.pdf({
          format: 'A4',
          printBackground: true,
          preferCSSPageSize: true,
          displayHeaderFooter: false,
          margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
        }),
      );
    } finally {
      await browser.close();
    }
  }
  async preview(id: string) {
    return this.render(await this.snapshot(id), false);
  }
  async generate(report: Report, _generatedById: string) {
    const snapshot = await this.snapshot(report.id);
    if (snapshot.version !== report.version || snapshot.status !== 'APPROVED')
      throw new AppError(
        409,
        'VERSION_CONFLICT',
        'O relatório foi alterado. Atualize a tela antes de finalizar.',
      );
    const bytes = await this.render(snapshot, true),
      id = randomUUID(),
      filePath = `reports/${report.id}/pdf/${id}.pdf`;
    const previous = await prisma.reportPdf.findFirst({
      where: { reportId: report.id },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    await this.storage.save(filePath, bytes);
    return { id, version: (previous?.version ?? 0) + 1, filePath };
  }
  discard(filePath: string) {
    return this.storage.delete(filePath);
  }
  async download(id: string) {
    await this.snapshot(id);
    const pdf = await prisma.reportPdf.findFirst({
      where: { reportId: id },
      orderBy: { version: 'desc' },
    });
    if (!pdf)
      throw new AppError(
        404,
        'PDF_NOT_FOUND',
        'Finalize o relatório aprovado para disponibilizar o PDF final.',
      );
    return this.storage.get(pdf.filePath);
  }
}

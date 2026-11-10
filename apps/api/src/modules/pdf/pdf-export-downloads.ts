import { randomUUID } from 'node:crypto';
import { AppError } from '../../errors/app-error';

// Short-lived delivery only; no report, media or PDF archive is changed.
export class PdfExportDownloads {
  private entries = new Map<
    string,
    { userId: string; reportId: string; expires: number; bytes: Buffer }
  >();
  private clean() {
    for (const [key, value] of this.entries)
      if (value.expires <= Date.now()) this.entries.delete(key);
  }
  create(userId: string, reportId: string, bytes: Buffer) {
    this.clean();
    if (bytes.length > 64 * 1024 * 1024)
      throw new AppError(
        413,
        'PDF_TOO_LARGE',
        'O PDF ficou muito grande para baixar de uma vez. Reduza a quantidade ou o tamanho das fotos e tente novamente.',
      );
    let size = bytes.length;
    for (const value of this.entries.values()) size += value.bytes.length;
    for (const [key, value] of this.entries) {
      if (size <= 64 * 1024 * 1024 && this.entries.size < 12) break;
      this.entries.delete(key);
      size -= value.bytes.length;
    }
    const token = randomUUID();
    this.entries.set(token, { userId, reportId, bytes, expires: Date.now() + 5 * 60000 });
    return token;
  }
  get(userId: string, reportId: string, token: string) {
    this.clean();
    const file = this.entries.get(token);
    if (!file || file.userId !== userId || file.reportId !== reportId)
      throw new AppError(
        404,
        'PDF_EXPORT_EXPIRED',
        'Este download expirou. Toque em “Baixar como está” novamente para preparar o PDF com os dados atuais.',
      );
    return file.bytes;
  }
}
export const pdfExportDownloads = new PdfExportDownloads();

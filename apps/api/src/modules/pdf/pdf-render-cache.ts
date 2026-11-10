import { createHash } from 'node:crypto';
import { AppError } from '../../errors/app-error';
import type { PdfReport } from './templates/reports/layout';

// Only lifecycle fields change between generating an approved PDF and downloading
// it. All printable data, photos, annotations and related company/project data
// remain part of the key. A new server process always starts with an empty cache.
export function pdfRenderKey(report: PdfReport, final: boolean) {
  const printable = { ...report } as Record<string, unknown>;
  for (const key of ['version', 'status', 'updatedAt', 'finishedAt']) delete printable[key];
  return createHash('sha256')
    .update(JSON.stringify([final, printable]))
    .digest('hex');
}

export class PdfRenderCache {
  private cache = new Map<string, { bytes: Buffer; expires: number }>();
  private pending = new Map<string, Promise<Buffer>>();
  private waiting: (() => void)[] = [];
  private active = false;
  constructor(
    private maxBytes = 32 * 1024 * 1024,
    private ttl = 5 * 60 * 1000,
    private waitMs = 30000,
  ) {}
  clear() {
    this.cache.clear();
  }
  private async acquire() {
    if (!this.active) {
      this.active = true;
      return;
    }
    const busy = () =>
      new AppError(
        503,
        'PDF_BUSY',
        'Há outros PDFs sendo preparados. Aguarde um pouco e tente novamente.',
      );
    if (this.waiting.length >= 12) throw busy();
    await new Promise<void>((resolve, reject) => {
      const ready = () => {
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(() => {
        this.waiting = this.waiting.filter((item) => item !== ready);
        reject(busy());
      }, this.waitMs);
      this.waiting.push(ready);
    });
  }
  run(key: string, render: () => Promise<Buffer>): Promise<Buffer> {
    for (const [id, entry] of this.cache) if (entry.expires <= Date.now()) this.cache.delete(id);
    const cached = this.cache.get(key);
    if (cached) return Promise.resolve(cached.bytes);
    const existing = this.pending.get(key);
    if (existing) return existing;
    const work = (async () => {
      await this.acquire();
      try {
        const bytes = await render();
        if (bytes.length <= this.maxBytes) {
          let size = bytes.length;
          for (const entry of this.cache.values()) size += entry.bytes.length;
          for (const [id, entry] of this.cache) {
            if (size <= this.maxBytes && this.cache.size < 20) break;
            this.cache.delete(id);
            size -= entry.bytes.length;
          }
          this.cache.set(key, { bytes, expires: Date.now() + this.ttl });
        }
        return bytes;
      } finally {
        const next = this.waiting.shift();
        if (next) next();
        else this.active = false;
      }
    })().finally(() => {
      this.pending.delete(key);
    });
    this.pending.set(key, work);
    return work;
  }
}

// Shared by POST generation and GET routes, which use different PdfService instances.
export const pdfRenderCache = new PdfRenderCache();

import { mkdir, writeFile, readFile, unlink, access, realpath, lstat } from 'node:fs/promises';
import path from 'node:path';
import type { StorageProvider } from './storage-provider';
import { AppError } from '../../errors/app-error';
export class LocalStorageProvider implements StorageProvider {
  private root: string;
  constructor(root: string) { this.root = path.resolve(root); }
  private async resolve(key: string) {
    if (!key || key.includes('\\') || key.includes(':') || path.isAbsolute(key) || key.split('/').some(part => !part || part === '.' || part === '..')) throw new AppError(400, 'INVALID_STORAGE_KEY', 'Caminho de arquivo inválido.');
    await mkdir(this.root, { recursive: true });
    const root = await realpath(this.root);
    let target = root;
    for (const part of key.split('/')) {
      target = path.join(target, part);
      try { if ((await lstat(target)).isSymbolicLink()) throw new AppError(400, 'INVALID_STORAGE_KEY', 'Links não são permitidos no storage.'); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
    return target;
  }
  async save(key: string, content: Buffer) { const target = await this.resolve(key); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, content, { flag: 'wx' }); }
  async get(key: string) { return readFile(await this.resolve(key)); }
  async getPath(key: string) { return this.resolve(key); }
  async delete(key: string) { await unlink(await this.resolve(key)); }
  async exists(key: string) { const target = await this.resolve(key); try { await access(target); return true; } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; } }
}

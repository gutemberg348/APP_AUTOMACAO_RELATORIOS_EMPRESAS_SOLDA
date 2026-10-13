import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { LocalStorageProvider } from '../../src/services/storage/local-storage-provider';
const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});
describe('private storage', () => {
  it('stores binary data, prevents overwrites, gets and deletes it', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'weldcosta-storage-'));
    directories.push(directory);
    const storage = new LocalStorageProvider(directory),
      key = 'companies/a/reports/b/images/c.bin',
      buffer = Buffer.from([0, 1, 2]);
    expect(await storage.exists(key)).toBe(false);
    await storage.save(key, buffer);
    expect(await storage.get(key)).toEqual(buffer);
    await expect(storage.save(key, buffer)).rejects.toThrow();
    await storage.delete(key);
    expect(await storage.exists(key)).toBe(false);
  });
  it.each(['../secret', '/absolute', 'C:/Windows/file', 'a/../b', 'a\\b', 'a//b'])(
    'rejects unsafe key %s',
    async (key) => {
      const directory = await mkdtemp(path.join(tmpdir(), 'weldcosta-storage-'));
      directories.push(directory);
      await expect(new LocalStorageProvider(directory).get(key)).rejects.toThrow(
        'Caminho de arquivo inválido',
      );
    },
  );
  it('rejects a directory link escaping storage', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'weldcosta-storage-'));
    directories.push(directory);
    const outside = await mkdtemp(path.join(tmpdir(), 'weldcosta-storage-outside-'));
    directories.push(outside);
    await symlink(
      outside,
      path.join(directory, 'link'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    await expect(
      new LocalStorageProvider(directory).save('link/file.bin', Buffer.from('test')),
    ).rejects.toThrow('Links não são permitidos');
  });
});

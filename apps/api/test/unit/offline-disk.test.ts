import { createRequire } from 'node:module';
import { beforeEach, expect, it, vi } from 'vitest';
const appRequire = createRequire(new URL('../../../app/services/offline-disk.ts', import.meta.url));
const files = new Map<string, string>();
let failWrite = false;
class Directory {
  uri: string;
  constructor(...parts: (string | { uri: string })[]) {
    this.uri = parts.map((p) => (typeof p === 'string' ? p : p.uri)).join('/');
  }
  create() {}
  list() {
    return [...files.keys()]
      .filter((k) => k.startsWith(this.uri + '/'))
      .map((k) => ({ name: k.slice(this.uri.length + 1) }));
  }
}
class File {
  uri: string;
  constructor(...parts: (string | { uri: string })[]) {
    this.uri = parts.map((p) => (typeof p === 'string' ? p : p.uri)).join('/');
  }
  get exists() {
    return files.has(this.uri);
  }
  create() {
    files.set(this.uri, '');
  }
  async write(text: string) {
    if (failWrite) {
      files.set(this.uri, '{"revision":');
      throw new Error('DISK FULL');
    }
    files.set(this.uri, text);
  }
  async text() {
    return files.get(this.uri);
  }
  delete() {
    files.delete(this.uri);
  }
}
vi.doMock(appRequire.resolve('react-native'), () => ({ Platform: { OS: 'android' } }));
vi.doMock(appRequire.resolve('expo-file-system'), () => ({
  File,
  Directory,
  Paths: { document: 'document' },
}));
const { offlineDisk } = await import('../../../app/services/offline-disk');
beforeEach(() => {
  files.clear();
  failWrite = false;
});
it('retains the last valid phone snapshot if a later write is interrupted or the disk fills up', async () => {
  await offlineDisk.put('account-a', 'draft-one', { number: '001', photos: ['a.jpg'] });
  failWrite = true;
  await expect(
    offlineDisk.put('account-a', 'draft-one', { number: '002', photos: [] }),
  ).rejects.toThrow('DISK FULL');
  expect(await offlineDisk.get('account-a', 'draft-one')).toEqual({
    number: '001',
    photos: ['a.jpg'],
  });
  failWrite = false;
  await offlineDisk.put('account-a', 'draft-one', { number: '003' });
  expect(await offlineDisk.get('account-a', 'draft-one')).toEqual({ number: '003' });
});
it('serializes consecutive writes and keeps separate account folders', async () => {
  await Promise.all([
    offlineDisk.put('a', 'draft-one', { value: 1 }),
    offlineDisk.put('a', 'draft-one', { value: 2 }),
  ]);
  await offlineDisk.put('b', 'draft-one', { value: 10 });
  expect(await offlineDisk.get('a', 'draft-one')).toEqual({ value: 2 });
  expect(await offlineDisk.get('b', 'draft-one')).toEqual({ value: 10 });
  expect(await offlineDisk.keys('a', 'draft-')).toEqual(['draft-one']);
});

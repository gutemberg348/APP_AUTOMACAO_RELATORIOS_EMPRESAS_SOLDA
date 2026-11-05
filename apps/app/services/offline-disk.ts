import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';

// All keys are internal. Account and API address form separate storage spaces.
export function offlineHash(text: string) {
  let a = 2166136261,
    b = 5381;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ text.charCodeAt(i);
  }
  return (a >>> 0).toString(16) + '-' + (b >>> 0).toString(16);
}
export function offlineDirectory(scope: string) {
  const directory = new Directory(Paths.document, 'weldcosta-offline', scope);
  directory.create({ intermediates: true, idempotent: true });
  return directory;
}
let database: Promise<IDBDatabase> | undefined;
function db() {
  return (database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('weldcosta-offline-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('items');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      database = undefined;
      reject(request.error);
    };
  }));
}
async function webRequest<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const database = await db();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction('items', mode);
    const request = run(transaction.objectStore('items'));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('Gravação local interrompida.'));
  });
}
const writes = new Map<string, Promise<unknown>>();
function serial<T>(key: string, run: () => Promise<T>): Promise<T> {
  const next = (writes.get(key) ?? Promise.resolve()).catch(() => {}).then(run);
  writes.set(key, next);
  void next
    .finally(() => {
      if (writes.get(key) === next) writes.delete(key);
    })
    .catch(() => {});
  return next;
}
type Slot<T> = { revision: number; value: T };
async function slots<T>(scope: string, key: string) {
  return Promise.all(
    ['a', 'b'].map(async (suffix) => {
      try {
        const file = new File(offlineDirectory(scope), `${key}.${suffix}.json`);
        return file.exists ? (JSON.parse(await file.text()) as Slot<T>) : undefined;
      } catch {
        return undefined;
      }
    }),
  );
}
export const offlineDisk = {
  async flush() {
    await Promise.all([...writes.values()]);
  },
  async get<T>(scope: string, key: string): Promise<T | undefined> {
    await writes.get(scope + ':' + key)?.catch(() => {});
    if (Platform.OS === 'web') return webRequest('readonly', (s) => s.get(scope + ':' + key));
    const valid = (await slots<T>(scope, key)).filter(
      (s): s is Slot<T> => !!s && Number.isFinite(s.revision),
    );
    return valid.sort((a, b) => b.revision - a.revision)[0]?.value;
  },
  put<T>(scope: string, key: string, value: T): Promise<void> {
    // Capture the value now, before subsequent form changes.
    const json = JSON.stringify(value);
    return serial(scope + ':' + key, async () => {
      if (Platform.OS === 'web') {
        await webRequest('readwrite', (s) => s.put(JSON.parse(json), scope + ':' + key));
        return;
      }
      const previous = await slots(scope, key);
      const revision = Math.max(0, ...previous.map((s) => s?.revision ?? 0)) + 1;
      const index = (previous[0]?.revision ?? 0) <= (previous[1]?.revision ?? 0) ? 'a' : 'b';
      const file = new File(offlineDirectory(scope), `${key}.${index}.json`);
      file.create({ overwrite: true });
      // Keep the other valid slot until this entire write succeeds.
      await file.write(`{"revision":${revision},"value":${json}}`);
    });
  },
  remove(scope: string, key: string) {
    return serial(scope + ':' + key, async () => {
      if (Platform.OS === 'web') {
        await webRequest('readwrite', (s) => s.delete(scope + ':' + key));
        return;
      }
      for (const suffix of ['a', 'b']) {
        const file = new File(offlineDirectory(scope), `${key}.${suffix}.json`);
        if (file.exists) file.delete();
      }
    });
  },
  async keys(scope: string, prefix: string) {
    if (Platform.OS === 'web') {
      const keys = await webRequest('readonly', (s) => s.getAllKeys());
      return keys
        .map(String)
        .filter((k) => k.startsWith(scope + ':' + prefix))
        .map((k) => k.slice(scope.length + 1));
    }
    return [
      ...new Set(
        offlineDirectory(scope)
          .list()
          .map((f) => f.name)
          .filter((n) => n.startsWith(prefix) && /\.[ab]\.json$/.test(n))
          .map((n) => n.replace(/\.[ab]\.json$/, '')),
      ),
    ];
  },
  async putBlob(scope: string, key: string, blob: Blob): Promise<void> {
    if (Platform.OS === 'web') {
      await webRequest('readwrite', (s) => s.put(blob, scope + ':blob-' + key));
      return;
    }
    const file = new File(offlineDirectory(scope), key);
    file.create({ overwrite: true });
    await file.write(await blob.bytes());
    await offlineDisk.put(
      scope,
      'mime-' + offlineHash(key),
      blob.type || file.type || 'image/jpeg',
    );
  },
  async getBlob(scope: string, key: string): Promise<Blob | undefined> {
    if (Platform.OS === 'web') return webRequest('readonly', (s) => s.get(scope + ':blob-' + key));
    const file = new File(offlineDirectory(scope), key);
    return file.exists
      ? new Blob([await file.arrayBuffer()], {
          type:
            (await offlineDisk.get<string>(scope, 'mime-' + offlineHash(key))) ||
            file.type ||
            'image/jpeg',
        })
      : undefined;
  },
  async removeBlob(scope: string, key: string) {
    if (Platform.OS === 'web') {
      await webRequest('readwrite', (s) => s.delete(scope + ':blob-' + key));
      return;
    }
    const file = new File(offlineDirectory(scope), key);
    if (file.exists) file.delete();
    await offlineDisk.remove(scope, 'mime-' + offlineHash(key));
  },
};

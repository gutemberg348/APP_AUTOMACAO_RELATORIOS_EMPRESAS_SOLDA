import { offlineDisk, offlineHash } from './offline-disk';
import { offlineStorageFailure } from '../stores/connectivity';

export const offlineScope = (apiUrl: string, userId: string) => offlineHash(apiUrl + ':' + userId);
const catalogRoot = (path: string) =>
  /^\/(companies|projects|report-types|reports)(?:\?|\/|$)/.exec(path)?.[1];
export const cacheablePath = (path: string) =>
  /^\/(companies|projects|report-types|reports|dashboard|people)(?:\?|\/|$)/.test(path) &&
  !path.includes('/pdf');
const catalogWrites = new Map<string, Promise<void>>();
export async function cacheApiData(scope: string, path: string, data: unknown) {
  if (!cacheablePath(path)) return;
  await offlineDisk.put(scope, 'get-' + offlineHash(path), data);
  const root = catalogRoot(path);
  if (root) {
    const response = data as { items?: { id: string }[]; id?: string };
    const entries = response.items ?? (response.id ? [response] : []);
    const key = scope + ':' + root;
    const operation = (catalogWrites.get(key) ?? Promise.resolve())
      .catch(() => {})
      .then(async () => {
        const previous =
          (await offlineDisk.get<Record<string, Record<string, unknown>>>(
            scope,
            'catalog-' + root,
          )) ?? {};
        for (const entry of entries) previous[entry.id!] = { ...previous[entry.id!], ...entry };
        await offlineDisk.put(scope, 'catalog-' + root, previous);
      });
    catalogWrites.set(key, operation);
    try {
      await operation;
    } finally {
      if (catalogWrites.get(key) === operation) catalogWrites.delete(key);
    }
  }
}
export async function cachedApiData<T>(scope: string, path: string): Promise<T | undefined> {
  const exact = await offlineDisk.get<T>(scope, 'get-' + offlineHash(path));
  if (exact !== undefined) return exact;
  const root = catalogRoot(path);
  if (!root) return;
  const catalog = await offlineDisk.get<Record<string, Record<string, unknown>>>(
    scope,
    'catalog-' + root,
  );
  if (!catalog) return;
  const [base, search = ''] = path.split('?');
  const id = base!.split('/')[2];
  if (id) return catalog[id] as T | undefined;
  const params = new URLSearchParams(search);
  let items = Object.values(catalog).filter(
    (item) =>
      (!params.get('companyId') || item.companyId === params.get('companyId')) &&
      (!params.get('status') || item.status === params.get('status')) &&
      (!params.get('search') ||
        JSON.stringify(item)
          .toLocaleLowerCase()
          .includes(params.get('search')!.toLocaleLowerCase())),
  );
  items = items.sort((a, b) =>
    String(a.name ?? a.title ?? a.number).localeCompare(String(b.name ?? b.title ?? b.number)),
  );
  const page = Number(params.get('page') || 1),
    limit = Number(params.get('limit') || 100);
  return {
    items: items.slice((page - 1) * limit, page * limit),
    total: items.length,
    page,
    limit,
    pages: Math.ceil(items.length / limit),
  } as T;
}
export function rememberApiData(scope: string, path: string, data: unknown) {
  void cacheApiData(scope, path, data).catch(offlineStorageFailure);
}

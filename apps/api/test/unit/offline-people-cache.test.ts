import { beforeEach, expect, it, vi } from 'vitest';

const memory = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../../../app/services/offline-disk', () => ({
  offlineHash: (value: string) => value,
  offlineDisk: {
    put: async (scope: string, key: string, value: unknown) => {
      memory.set(scope + ':' + key, structuredClone(value));
    },
    get: async (scope: string, key: string) => structuredClone(memory.get(scope + ':' + key)),
  },
}));
vi.mock('../../../app/stores/connectivity', () => ({ offlineStorageFailure: vi.fn() }));
import { cacheApiData, cachedApiData } from '../../../app/services/offline-cache';

beforeEach(() => memory.clear());

it('finds prepared people offline with different search/page parameters and excludes inactive people', async () => {
  await cacheApiData('account-a', '/people?active=true&page=1', {
    items: [
      { id: '1', name: 'Fábio', company: 'Weld', registrationNumber: 'CREA 123', active: true },
      { id: '2', name: 'Ana', company: 'Weld', active: true },
    ],
  });
  await cacheApiData('account-a', '/people?active=false&page=1', {
    items: [{ id: '3', name: 'Inativo', company: 'Weld', active: false }],
  });
  const all = await cachedApiData<{ items: { id: string }[] }>(
    'account-a',
    '/people?search=WELD&page=1&active=true',
  );
  expect(all?.items.map((person) => person.id)).toEqual(['2', '1']);
  expect(await cachedApiData('account-a', '/people?search=123&page=1&active=true')).toMatchObject({
    items: [{ id: '1' }],
    total: 1,
  });
  expect(await cachedApiData('account-b', '/people?search=&page=1&active=true')).toBeUndefined();
});

it('keeps the people endpoint page size when reading prepared pages offline', async () => {
  await cacheApiData('account-a', '/people?active=true&page=1', {
    items: Array.from({ length: 35 }, (_, i) => ({
      id: String(i),
      name: 'Pessoa ' + String(i).padStart(2, '0'),
      active: true,
    })),
  });
  expect(await cachedApiData('account-a', '/people?search=&page=2&active=true')).toMatchObject({
    items: Array.from({ length: 5 }, (_, i) => ({ id: String(i + 30) })),
    total: 35,
    pages: 2,
    limit: 30,
  });
});

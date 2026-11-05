import { create } from 'zustand';
import type { Paginated, Report } from '@weldcosta/shared';
import { api, apiUrl } from '../../services/api';
import { useAuth } from '../../stores/auth';
import { useConnectivity } from '../../stores/connectivity';
import { offlineDisk } from '../../services/offline-disk';
import { offlineScope } from '../../services/offline-cache';
import { prepareOfflineCatalog, prepareReportOffline } from './offline-prepare';
import { syncWaitingReports } from './offline-report-sync';
import { useOfflineReports } from './offline-report-store';

export const useOfflineSynchronization = create<{
  accountId?: string;
  busy: boolean;
  message: string;
  error?: string;
}>(() => ({ busy: false, message: '' }));
const running = new Map<string, Promise<void>>();

/** One queue for the automatic preparation and the manual Sync button. */
export function synchronizeOffline(force = false): Promise<void> {
  const accountId = useAuth.getState().session?.user.id;
  if (!accountId || !useConnectivity.getState().online) return Promise.resolve();
  const existing = running.get(accountId);
  if (existing) return existing;
  const scope = offlineScope(apiUrl, accountId);
  const current = () => useAuth.getState().session?.user.id === accountId;
  const check = () => {
    if (!current() || !useConnectivity.getState().online)
      throw new Error('A sincronização foi interrompida. Os dados locais foram mantidos.');
  };
  const progress = (message: string) => {
    if (current()) useOfflineSynchronization.setState({ accountId, message });
  };
  const job = (async () => {
    try {
      const last = await offlineDisk.get<number>(scope, 'last-offline-preparation');
      check();
      if (!force && last && Date.now() - last < 5 * 60 * 1000) return;
      useOfflineSynchronization.setState({
        accountId,
        busy: true,
        error: undefined,
        message: 'Sincronizando…',
      });
      useConnectivity.setState({ storageError: undefined });
      // Never overwrite an open form or resolve conflicts without the user.
      await syncWaitingReports();
      check();
      await prepareOfflineCatalog(progress);
      let page = 1,
        pages = 1;
      do {
        check();
        progress(`Atualizando relatórios · página ${page}…`);
        const reports = await api<Paginated<Report>>('/reports?limit=100&page=' + page, {
          accountId,
        });
        pages = reports.pages;
        for (const report of reports.items) {
          check();
          const key = 'prepared-report-' + report.id;
          const version = await offlineDisk.get<number>(scope, key);
          if (!force && version === report.version) continue;
          await prepareReportOffline(report, progress);
          check();
          if (useConnectivity.getState().storageError)
            throw new Error(useConnectivity.getState().storageError);
          await offlineDisk.put(scope, key, report.version);
        }
        page++;
      } while (page <= pages);
      check();
      await offlineDisk.flush();
      if (useConnectivity.getState().storageError)
        throw new Error(useConnectivity.getState().storageError);
      await offlineDisk.put(scope, 'last-offline-preparation', Date.now());
      const pending = Object.keys(useOfflineReports.getState().drafts).length;
      progress(
        pending
          ? 'Dados disponíveis offline. Confira os relatórios pendentes abaixo.'
          : 'Tudo sincronizado e disponível offline.',
      );
    } catch (cause) {
      if (current())
        useOfflineSynchronization.setState({
          accountId,
          error:
            useConnectivity.getState().storageError ||
            (useConnectivity.getState().online
              ? 'Não foi possível concluir a sincronização. Os dados locais foram mantidos. Toque em Sincronizar para tentar novamente.'
              : undefined),
          message: useConnectivity.getState().online
            ? ''
            : 'Sem internet. A sincronização continuará quando a conexão voltar.',
        });
      // Detailed errors belong in diagnostics, not a raw JavaScript message in the UI.
      console.warn('Sincronização offline incompleta', cause);
    } finally {
      if (current()) useOfflineSynchronization.setState({ busy: false });
    }
  })().finally(() => {
    if (running.get(accountId) === job) running.delete(accountId);
  });
  running.set(accountId, job);
  return job;
}

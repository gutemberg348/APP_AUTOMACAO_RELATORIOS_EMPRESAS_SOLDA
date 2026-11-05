import type { Paginated, Project, Company, ReportType, Report } from '@weldcosta/shared';
import { api, apiUrl } from '../../services/api';
import { useConnectivity } from '../../stores/connectivity';
import { useAuth } from '../../stores/auth';
import { offlineScope } from '../../services/offline-cache';
import { offlineDisk, offlineHash } from '../../services/offline-disk';

function offlineAccount() {
  const accountId = useAuth.getState().session?.user.id;
  if (!accountId) throw new Error('Entre na sua conta para sincronizar.');
  const check = () => {
    if (useAuth.getState().session?.user.id !== accountId)
      throw new Error('A conta mudou. Sincronize novamente na conta atual.');
    if (!useConnectivity.getState().online)
      throw new Error('Sem conexão. A sincronização continuará quando a internet voltar.');
  };
  return { accountId, check, scope: offlineScope(apiUrl, accountId) };
}

export async function prepareOfflineCatalog(progress: (text: string) => void) {
  if (!useConnectivity.getState().online)
    throw new Error(
      'Conecte à internet para carregar as empresas, obras e modelos pela primeira vez.',
    );
  const { accountId, check } = offlineAccount();
  check();
  progress('Carregando modelos…');
  await api<Paginated<ReportType>>('/report-types?limit=100&sortBy=name&sortOrder=asc', {
    accountId,
  });
  const companies: Company[] = [],
    projects: Project[] = [];
  for (const [endpoint, target] of [
    ['/companies?status=ACTIVE', companies],
    ['/projects?status=ACTIVE', projects],
  ] as const) {
    let page = 1,
      pages = 1;
    do {
      progress(
        `Carregando ${endpoint.startsWith('/companies') ? 'empresas' : 'obras'} · página ${page}…`,
      );
      check();
      const list = await api<Paginated<Company & Project>>(endpoint + '&limit=100&page=' + page, {
        accountId,
      });
      if (!useConnectivity.getState().online)
        throw new Error(
          'A conexão caiu. O que já foi carregado ficou salvo; conecte e prepare novamente para completar.',
        );
      target.push(...list.items);
      pages = list.pages;
      page++;
    } while (page <= pages);
  }
  for (const company of companies) {
    progress('Guardando empresa · ' + company.name);
    check();
    await api('/companies/' + company.id, { accountId });
  }
  for (const project of projects) {
    progress('Guardando dados da obra · ' + project.name);
    check();
    await api('/projects/' + project.id, { accountId });
  }
  if (!useConnectivity.getState().online || useConnectivity.getState().storageError)
    throw new Error(
      'Não foi possível concluir o preparo. Confira a conexão e o espaço livre do telefone.',
    );
  return `${companies.length} empresas e ${projects.length} obras disponíveis neste telefone.`;
}
export async function prepareReportOffline(report: Report, progress: (text: string) => void) {
  if (!useConnectivity.getState().online)
    throw new Error('Conecte à internet para guardar as fotos que ainda não estão neste telefone.');
  const { accountId, scope, check } = offlineAccount();
  check();
  progress('Guardando o relatório…');
  const current = await api<Report>('/reports/' + report.id, { accountId });
  check();
  await api('/projects/' + current.projectId, { accountId });
  await api('/companies/' + current.companyId, { accountId });
  const cachePhoto = async (path: string) => {
    check();
    if (!(await offlineDisk.hasBlob(scope, 'remote-' + offlineHash(path))))
      await api<Blob>(path, { accountId }, true, true);
    check();
  };
  let count = 0;
  for (const media of current.media ?? []) {
    progress(`Guardando foto ${++count} de ${current.media?.length}…`);
    await cachePhoto('/reports/' + current.id + '/media/' + media.id);
  }
  for (const signer of current.signatures ?? [])
    if (signer.signatureAssetId) await cachePhoto('/people/signatures/' + signer.signatureAssetId);
  if (useConnectivity.getState().storageError)
    throw new Error(
      'Não foi possível guardar todos os arquivos. Confira o espaço livre e sincronize novamente.',
    );
  return 'Relatório e fotos disponíveis sem internet.';
}

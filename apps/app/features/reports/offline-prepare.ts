import type { Paginated, Project, Company, ReportType, Report } from '@weldcosta/shared';
import { api, apiBlob } from '../../services/api';
import { useConnectivity } from '../../stores/connectivity';

export async function prepareOfflineCatalog(progress: (text: string) => void) {
  if (!useConnectivity.getState().online)
    throw new Error(
      'Conecte à internet para carregar as empresas, obras e modelos pela primeira vez.',
    );
  progress('Carregando modelos…');
  await api<Paginated<ReportType>>('/report-types?limit=100&sortBy=name&sortOrder=asc');
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
      const list = await api<Paginated<Company & Project>>(endpoint + '&limit=100&page=' + page);
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
    await api('/companies/' + company.id);
  }
  for (const project of projects) {
    progress('Guardando dados da obra · ' + project.name);
    await api('/projects/' + project.id);
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
  progress('Guardando o relatório…');
  await api('/reports/' + report.id);
  await api('/projects/' + report.projectId);
  await api('/companies/' + report.companyId);
  let count = 0;
  for (const media of report.media ?? []) {
    progress(`Guardando foto ${++count} de ${report.media?.length}…`);
    await apiBlob('/reports/' + report.id + '/media/' + media.id);
    if (!useConnectivity.getState().online)
      throw new Error('A conexão caiu. Prepare novamente para completar as fotos.');
  }
  for (const signer of report.signatures ?? [])
    if (signer.signatureAssetId) await apiBlob('/people/signatures/' + signer.signatureAssetId);
  if (useConnectivity.getState().storageError)
    throw new Error('Confira o espaço livre do telefone e prepare novamente.');
  return 'Relatório e fotos disponíveis para consulta e preenchimento sem internet.';
}

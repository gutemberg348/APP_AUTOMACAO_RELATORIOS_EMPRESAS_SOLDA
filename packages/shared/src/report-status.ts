import type { ReportStatus } from './enums';

export function canSetReportStatus(
  from: ReportStatus,
  to: ReportStatus,
  permissions: readonly string[],
) {
  if (from === to) return false;
  if (to === 'FINISHED') return from === 'APPROVED' && permissions.includes('reports.finish');
  if (from === 'FINISHED' && !permissions.includes('reports.review')) return false;
  if (to === 'DRAFT') return permissions.includes('reports.review');
  if (to === 'APPROVED') return permissions.includes('reports.approve');
  return permissions.includes('reports.submit') || permissions.includes('reports.review');
}

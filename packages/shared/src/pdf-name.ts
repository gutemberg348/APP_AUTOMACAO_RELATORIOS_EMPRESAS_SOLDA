/** Human-readable download name shared by the API and app. */
export function reportPdfName(report: {
  number?: string | null;
  title?: string | null;
  reportType: { code: string; name?: string };
  project?: { name: string };
  specificData?: unknown;
}) {
  const clean = (value: string) =>
    value
      .normalize('NFC')
      // eslint-disable-next-line no-control-regex -- Strip control characters from filenames.
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const data = report.specificData as Record<string, unknown> | undefined;
  const area =
    report.reportType.code === 'LP' && typeof data?.inspectionArea === 'string'
      ? data.inspectionArea.trim()
      : '';
  let title = area || report.title?.trim() || report.project?.name || 'RELATÓRIO';
  if (!area && report.reportType.name && title.endsWith(' · ' + report.reportType.name))
    title = title.slice(0, -(' · ' + report.reportType.name).length);
  const code = report.reportType.code === 'ME' ? 'M.E' : report.reportType.code;
  return (
    `REL ${clean(report.number || 'SEM NÚMERO').slice(0, 40)} - ${clean(code)} - ${clean(title).slice(0, 110)}`.toLocaleUpperCase(
      'pt-BR',
    ) + '.pdf'
  );
}

import { reportSectionId, type CustomReportPage, type ReportSection } from '@weldcosta/shared';

type Section = ReportSection & { content?: string };
export function customPagePositionOptions(sections: Section[], page: CustomReportPage) {
  const options = [
    { value: 'start', label: 'Início do relatório' },
    ...sections
      .filter((section) => reportSectionId(section) !== 'signatures')
      .map((section) => ({
        value: 'section:' + reportSectionId(section),
        label: `Abaixo de: ${section.title === 'Laudo' ? 'Conclusão' : section.title === 'Dados' ? 'Informações' : section.title}`,
      })),
  ];
  options.push({ value: 'end', label: 'Final do relatório' });
  const selected = customPagePositionValue(page);
  if (!options.some((option) => option.value === selected))
    options.unshift({
      value: selected,
      label:
        page.position === 'afterPage'
          ? `Após a folha ${page.afterPage ?? 1} (posição salva)`
          : page.position === 'start'
            ? 'Início do relatório (posição salva)'
            : page.position === 'beforeConclusion'
              ? 'Antes da conclusão (posição salva)'
              : 'Etapa removida (posição salva)',
    });
  return options;
}
export function customPagePositionValue(page: CustomReportPage) {
  if (page.position === 'afterSignatures') return 'end';
  if (page.position === 'afterIdentification') return 'section:identification';
  if (page.position === 'afterSection') return 'section:' + (page.afterSection ?? 'identification');
  return page.position;
}
export function customPagePositionLabel(sections: Section[], page: CustomReportPage) {
  const selected = customPagePositionValue(page);
  return customPagePositionOptions(sections, page).find((option) => option.value === selected)!
    .label;
}

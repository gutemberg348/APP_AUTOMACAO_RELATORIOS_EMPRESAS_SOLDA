import {
  cover,
  identification,
  drawings,
  sheet,
  band,
  annotations,
  conclusion,
  acceptable,
  escape,
  type PdfReport,
} from '../reference-layout';

export function render(report: PdfReport, images: Map<string, string>) {
  const data = report.specificData as Record<string, unknown>;
  let html =
    cover(report) +
    identification(report, [
      ['PROPRIETÁRIO', 'owner'],
      ['OBRA', 'work'],
      ['PROJETO', 'project'],
      ['DESENHO', 'drawing'],
      ['ENSAIO', 'inspectionType'],
      ['ESPESSURA DE PROJETO', 'projectThickness'],
      ['METAL DE BASE', 'baseMetal'],
      ['NORMA DE REF.', 'referenceStandard'],
    ]) +
    drawings(report, images);
  type Group = { label: string; points: PdfReport['points']; photos: PdfReport['media'] };
  const groups: Group[] = [];
  for (const point of report.points) {
    const label = point.label?.trim() || 'Ponto ' + point.number;
    let group = groups.find((g) => g.label === label);
    if (!group) {
      group = { label, points: [], photos: [] };
      groups.push(group);
    }
    group.points.push(point);
    group.photos.push(...report.media.filter((m) => m.reportPointId === point.id));
  }
  const general = report.media.filter((m) => !m.reportPointId && m.sectionKey !== 'drawing');
  if (general.length)
    groups.push({ label: 'Equipamento / registro geral', points: [], photos: general });
  let content = data.equipment ? annotations(data.equipment, 'EQUIPAMENTO') : '';
  const cell = (group: Group | undefined, part: number) => {
    if (!group) return '<div class="measurement-cell"></div>';
    const points = group.points.slice(part * 5, part * 5 + 5);
    const photos = group.photos.slice(part * 2, part * 2 + 2);
    const first = (points[0]?.data ?? {}) as Record<string, unknown>;
    const photo = (index: number) =>
      `<div class="measurement-photo">${photos[index] ? `<img src="${images.get(photos[index]!.id) || ''}">` : ''}</div>`;
    return `<div class="measurement-cell"><div class="reference-photo-tab">LADO: <span>${escape(group.label.slice(0, 80))}${part ? ' (continuação)' : ''}</span></div><div class="reference-photo-tab">DESCONT.: <span>${escape(String(first.discontinuity || '—').slice(0, 50))}</span> · ACEITÁVEL: <span>${acceptable(first)}</span></div>${photo(0)}<div class="reference-photo-tab">PONTOS · ESPESSURA DE PROJETO: <span>${escape(String(first.projectThickness || data.projectThickness || '—').slice(0, 50))}</span></div>${Array.from(
      { length: 5 },
      (_, i) => {
        const p = points[i];
        const d = (p?.data ?? {}) as Record<string, unknown>;
        return `<div class="measurement-reading">${p ? `PONTO ${escape(p.number)}: <span>${escape(p.value == null ? '—' : p.value.toLocaleString('pt-BR', { maximumFractionDigits: 20 }))} ${escape(p.unit || 'mm')}</span> · ACEITÁVEL: ${acceptable(d)}` : '&nbsp;'}</div>`;
      },
    ).join('')}${photo(1)}</div>`;
  };
  for (let i = 0; i < groups.length; i += 2) {
    const pair = groups.slice(i, i + 2);
    const parts = Math.max(
      ...pair.map((g) =>
        Math.max(1, Math.ceil(g.points.length / 5), Math.ceil(g.photos.length / 2)),
      ),
    );
    for (let part = 0; part < parts; part++) {
      content += `<div class="measurement-block">${band('IMAGENS DO ENSAIO')}<div class="measurement-columns">${cell(pair[0], part)}${cell(pair[1], part)}</div></div>`;
      for (const group of pair) {
        if (group.label.length > 80) content += annotations(group.label, 'Lado / identificação');
        for (const m of group.photos.slice(part * 2, part * 2 + 2))
          if (m.caption) content += annotations(m.caption, group.label);
        for (const p of group.points.slice(part * 5, part * 5 + 5)) {
          const d = (p.data ?? {}) as Record<string, unknown>;
          const notes = [
            d.notes,
            d.dimension ? 'Dimensão: ' + d.dimension : '',
            d.projectThickness ? 'Espessura de projeto: ' + d.projectThickness : '',
            d.discontinuity ? 'Descontinuidade: ' + d.discontinuity : '',
          ]
            .filter(Boolean)
            .join(' · ');
          if (notes) content += annotations(notes, 'Ponto ' + p.number);
        }
      }
    }
  }
  if (!groups.length) content += annotations('Nenhum ponto de medição informado.');
  html += sheet(report, 'PARTE DO EQUIPAMENTO<br>OU LINHA', content, true);
  return (
    html + conclusion(report, data.finalReport, ['TÉCNICO INSPEÇÃO', 'INSPETOR', 'CLIENTE'], true)
  );
}

import { lpChoiceValue, lpPenetrantOptions, lpRemovalOptions } from '@weldcosta/shared';
import { annotations, band, displayDate, escape, value } from '../reference-layout';

export function lpTechnical(data: Record<string, unknown>) {
  const overflow: string[] = [];
  const cell = (raw: unknown, label: string, limit = 45) => {
    const text = String(raw ?? '');
    if (text.length > limit) overflow.push(annotations(text, label));
    return escape(text.length > limit ? text.slice(0, limit) + '…' : text || '');
  };
  const choices = (kind: 'penetrant' | 'removal', raw: unknown) => {
    const selected = lpChoiceValue(kind, raw);
    const options = kind === 'penetrant' ? lpPenetrantOptions : lpRemovalOptions;
    return (
      options
        .map(
          (option) =>
            `<span class="lp-check"><span aria-hidden="true">${selected === option.value ? '(X)' : '( )'}</span> ${escape(option.label.replace(' · ', ' '))}</span>`,
        )
        .join('') +
      (!selected && raw
        ? `<div class="lp-custom-choice">${cell(raw, kind === 'penetrant' ? 'Tipo de penetrante' : 'Técnica de remoção', 50)}</div>`
        : '')
    );
  };
  const conditions = [
    ['TEMPERATURA', 'temperature'],
    ['ESPESSURA', 'thickness'],
    ['CONDIÇÃO SUPERFICIAL', 'surfaceCondition'],
    ['INTENSIDADE DE ILUMINAÇÃO', 'lightingIntensity'],
    ['METAL DE BASE', 'baseMetal'],
  ];
  const materials = ['cleaner', 'penetrant', 'remover', 'developer'];
  let body = `<section class="lp-general-page"><div class="lp-general-conditions"><table class="lp-form-table"><thead><tr>${conditions.map(([label]) => `<th>${label}</th>`).join('')}</tr></thead><tbody><tr>${conditions.map(([label, key]) => `<td>${cell(value(data, 'generalData.' + key), label!, 35)}</td>`).join('')}</tr></tbody></table></div>`;
  body += `<div class="lp-materials">${band('MATERIAIS UTILIZADOS')}<table class="lp-form-table lp-choices"><thead><tr><th>PENETRANTE</th><th>TÉCNICA DE REMOÇÃO</th></tr></thead><tbody><tr><td>${choices('penetrant', data.penetrantType)}</td><td>${choices('removal', data.removalTechnique)}</td></tr></tbody></table><table class="lp-form-table lp-material-table"><colgroup><col style="width:22%">${materials.map(() => '<col style="width:19.5%">').join('')}</colgroup><thead><tr><th></th><th>LIMPEZA<br>(SOLVENTE)</th><th>PENETRANTE</th><th>REMOVEDOR</th><th>REVELADOR</th></tr></thead><tbody>${[
    ['FABRICANTE', 'manufacturer'],
    ['MARCA', 'brand'],
    ['LOTE', 'lot'],
    ['VALIDADE', 'expirationDate'],
  ]
    .map(
      ([label, key]) =>
        `<tr><th>${label}</th>${materials
          .map((material) => {
            const raw = value(data, `materials.${material}.${key}`);
            return `<td>${cell(key === 'expirationDate' && raw ? displayDate(String(raw)) : raw, `${label} · ${material}`, 35)}</td>`;
          })
          .join('')}</tr>`,
    )
    .join('')}</tbody></table></div>`;
  const indications = (data.discontinuities ?? []) as { code: string; description?: string }[];
  const indicationTable = (offset: number, firstPage: boolean) => {
    const rows = indications.slice(offset, offset + 12);
    return `<div class="lp-indications ${firstPage ? '' : 'lp-indications-continuation'}">${band('DESCONTINUIDADES' + (offset ? ' · CONTINUAÇÃO' : ''))}<table class="lp-form-table"><colgroup><col style="width:23%"><col style="width:54%"><col style="width:23%"></colgroup><tbody>${Array.from({ length: 12 }, (_, i) => `<tr>${i === 0 ? `<td rowspan="12" class="lp-inspection-area">${cell(data.inspectionArea, 'Área / linha inspecionada', 160)}</td>` : ''}<td class="lp-indication-description">${cell(rows[i]?.description, 'Descrição da descontinuidade ' + (offset + i + 1), 70)}</td>${i === 0 && !rows.some((row) => row.code) ? '<td rowspan="12"></td>' : rows.some((row) => row.code) ? `<td class="lp-indication-code">${cell(rows[i]?.code, 'Código da descontinuidade ' + (offset + i + 1), 20)}</td>` : ''}</tr>`).join('')}</tbody></table></div>`;
  };
  body += indicationTable(0, true);
  body += `<div class="lp-legend">${band('LEGENDA')}<table class="lp-form-table"><tbody>${[
    ['A - APROVADO', 'PO - PORO', 'SP - SOBREPOSIÇÃO'],
    ['R - REPROVADO', 'TR - TRINCA RAMIFICADA', 'FF - FALTA DE FUSÃO'],
    ['REC - RECOMENDAÇÃO', 'TL - TRINCA LONGITUDINAL', 'FP - FALTA DE PENETRAÇÃO'],
    ['COMPLETAR', 'TT - TRINCA TRANSVERSAL', 'MO - MORDEDURA'],
    ['', '', ''],
  ]
    .map((row) => `<tr>${row.map((text) => `<td>${text || '&nbsp;'}</td>`).join('')}</tr>`)
    .join('')}</tbody></table></div></section>`;
  for (let offset = 12; offset < indications.length; offset += 12)
    body += indicationTable(offset, false);
  return body + overflow.join('');
}

import { drawingImageSources, isEmbeddedDrawingImage } from './layout';
import { drawingDataSchema, drawingSvg, drawingNotesSvg } from '@weldcosta/shared';
import { chunks, header, footer } from './evs';
import { escape, displayDate, signatureImage, type PdfReport } from './layout';
export { chunks } from './evs';
export { escape, displayDate, type PdfReport } from './layout';

export const titles: Record<string, string> = {
  LP: 'RELATÓRIO DE LÍQUIDO<br>PENETRANTE',
  TH: 'RELATÓRIO DE TESTE<br>HIDROSTÁTICO',
  ME: 'RELATÓRIO DE MEDIÇÃO<br>DE ESPESSURA',
  RDO: 'RELATÓRIO DIÁRIO<br>DE INSPEÇÃO',
};
export function value(data: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (item, key) =>
        item && typeof item === 'object' ? (item as Record<string, unknown>)[key] : undefined,
      data,
    );
}
export function sheet(
  report: PdfReport,
  title: string,
  blocks: string,
  contact = false,
  kind = '',
) {
  return `<article class="evs-sheet reference-sheet ${kind}">${header(report, title)}<main class="evs-flow">${blocks}</main>${contact ? footer : ''}</article>`;
}
export function annotations(text: unknown, label = '') {
  return chunks(text)
    .map(
      (part) =>
        `<p class="evs-annotation">${label ? `<b>${escape(label)}:</b> ` : ''}${escape(part || '—')}</p>`,
    )
    .join('');
}
export function cover(report: PdfReport) {
  const data = report.specificData as Record<string, unknown>;
  return sheet(
    report,
    titles[report.reportType.code]!,
    ['client', report.reportType.code === 'TH' ? 'location' : 'factory']
      .map((key) =>
        chunks(data[key], 300)
          .map(
            (part, i) =>
              `<div class="evs-cover-block"><b>${{ client: 'CLIENTE', location: 'LOCAL', factory: 'FÁBRICA' }[key]}${i ? ' (continuação)' : ''}:</b><p>${escape(part || '—')}</p></div>`,
          )
          .join(''),
      )
      .join(''),
    true,
    'evs-cover',
  );
}
export function identification(report: PdfReport, fields: [string, string][]) {
  const body =
    chunks(report.title || report.project.name)
      .map((part) => `<h1 class="evs-data-title">${escape(part)}</h1>`)
      .join('') +
    fields
      .map(([label, path]) =>
        chunks(value(report.specificData, path))
          .map(
            (part, i) =>
              `<p class="evs-data-line"><b>${escape(label)}${i ? ' (continuação)' : ''}:</b> ${escape(part || '—')}</p>`,
          )
          .join(''),
      )
      .join('');
  return sheet(report, titles[report.reportType.code]!, body, true, 'reference-identification');
}
export function drawings(report: PdfReport, images: Map<string, string>) {
  let html = '';
  for (const drawing of report.drawings) {
    const cad = drawingDataSchema.parse(drawing.data);
    const notesSvg = drawingNotesSvg(cad);
    html += sheet(
      report,
      'DESENHO',
      `<div class="evs-drawing"${notesSvg ? ' style="height:165mm"' : ''}>${drawingSvg(
        cad,
        report.points.map((p) => ({
          id: p.id,
          number: p.number,
          data: (p.data ?? {}) as { acceptable?: boolean },
        })),
        { images: drawingImageSources(report, images) },
      )}</div>` +
        annotations(cad.title + ' · Rev. ' + cad.revision + ' · Sem escala') +
        (notesSvg
          ? `<section class="drawing-notes" style="height:64mm;padding:0 3mm"><b style="font-size:11px">OBSERVAÇÕES</b><div style="height:58mm">${notesSvg}</div></section>`
          : '') +
        (cad.notes ? annotations(cad.notes, 'Notas') : ''),
    );
  }
  for (const media of report.media.filter(
    (m) => m.sectionKey === 'drawing' && !m.reportPointId && !isEmbeddedDrawingImage(m),
  ))
    html += sheet(
      report,
      'DESENHO',
      `<div class="evs-drawing"><img src="${images.get(media.id) || ''}"></div>` +
        (media.caption ? annotations(media.caption) : ''),
    );
  return html;
}
export const band = (label: string) => `<h2 class="reference-band">${escape(label)}</h2>`;

// Table cells have short previews; full long values are printed immediately below the table.
export function matrix(headers: string[], rows: unknown[][], caption = '') {
  const overflow: string[] = [];
  const cells = rows
    .map(
      (row, index) =>
        `<tr>${row
          .map((raw, col) => {
            const text = String(raw ?? '') || '—';
            if (text.length > 100)
              overflow.push(
                annotations(
                  text,
                  `${caption || 'Tabela'} · ${index + 1} · ${headers[col] || col + 1}`,
                ),
              );
            return `<td>${escape(text.length > 100 ? text.slice(0, 100) + '…' : text)}</td>`;
          })
          .join('')}</tr>`,
    )
    .join('');
  return (
    `<div class="reference-table-block">${caption ? band(caption) : ''}<table class="reference-table"><thead><tr>${headers.map((h) => `<th>${escape(h)}</th>`).join('')}</tr></thead><tbody>${cells}</tbody></table></div>` +
    overflow.join('')
  );
}
export function fieldMatrix(data: unknown, fields: [string, string][], caption = '') {
  return matrix(
    fields.map(([label]) => label),
    [fields.map(([, key]) => value(data, key))],
    caption,
  );
}
export function resultAndSignatures(
  report: PdfReport,
  labels = ['INSPETOR', 'APROVADO POR', 'CLIENTE'],
) {
  const data = report.specificData as Record<string, unknown>;
  const used = new Set<string>();
  const cell = (label: string, signer?: PdfReport['signatures'][number]) => {
    if (signer) used.add(signer.id);
    return `<div class="evs-signer"><div>${escape(label)}</div><div class="evs-signature-space">${signatureImage(report, signer)}</div><div class="evs-signature-name">${escape(signer?.name || '')}</div><div>${escape(signer?.registrationNumber || '')}</div><p>DATA: ${signer?.signedAt ? displayDate(signer.signedAt) : ''}</p></div>`;
  };
  const signer = (role: string) => report.signatures.find((s) => s.role === role);
  const main =
    cell(labels[0]!, signer('INSPECTOR')) +
    cell(labels[1]!, signer('TECHNICAL_RESPONSIBLE') || signer('REVIEWER')) +
    cell(labels[2]!, signer('CLIENT'));
  let html = `<div class="evs-signoff"><div class="evs-result">${[
    ['APPROVED', 'APROVADO'],
    ['REJECTED', 'REPROVADO'],
    ['COMPLEMENTARY_EXAM', 'EXAME COMPLEMENTAR'],
  ]
    .map(([code, name]) => `<b>${name} (${data.finalResult === code ? 'X' : ' '})</b>`)
    .join('')}</div><div class="evs-signers">${main}</div></div>`;
  for (const person of report.signatures.filter((s) => !used.has(s.id)))
    html += `<div class="evs-signers">${cell(person.role === 'REVIEWER' ? 'REVISOR' : 'RESPONSÁVEL', person)}</div>`;
  return html;
}
export function conclusion(
  report: PdfReport,
  text: unknown,
  labels?: string[],
  contact = false,
  observation = false,
) {
  return sheet(
    report,
    'LAUDO FINAL',
    (observation ? band('OBSERVAÇÃO') : '') +
      chunks(text)
        .map(
          (part, i) =>
            `<div class="reference-conclusion ${i ? 'continuation' : ''}">${escape(part || 'Laudo não informado.')}</div>`,
        )
        .join('') +
      resultAndSignatures(report, labels),
    contact,
    'reference-final',
  );
}
export const acceptable = (data: Record<string, unknown>) =>
  data.acceptable === true ? 'SIM' : data.acceptable === false ? 'NÃO' : '—';
export function pointNotes(point: PdfReport['points'][number]) {
  const data = (point.data ?? {}) as Record<string, unknown>;
  return [
    point.label,
    data.notes,
    data.dimension ? 'Dimensão: ' + data.dimension : '',
    data.projectThickness ? 'Espessura de projeto: ' + data.projectThickness : '',
    point.value != null ? 'Leitura: ' + point.value + ' ' + (point.unit || '') : point.unit,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function photoRows(
  report: PdfReport,
  images: Map<string, string>,
  mode: 'LP' | 'TH' | 'RDO',
) {
  type Entry = { point?: PdfReport['points'][number]; image?: PdfReport['media'][number] };
  const groups: Entry[][] = report.points.map((point) => {
    const media = report.media.filter((m) => m.reportPointId === point.id);
    return media.length ? media.map((image) => ({ point, image })) : [{ point, image: undefined }];
  });
  const entries: Entry[] = [];
  if (mode === 'LP') {
    // Keep the two welds in the same columns as their successive inspection photos.
    for (let i = 0; i < groups.length; i += 2) {
      const left = groups[i]!;
      const right = groups[i + 1] ?? [];
      if (!right.length) {
        entries.push(...left);
        continue;
      }
      for (let j = 0; j < Math.max(left.length, right.length); j++) {
        entries.push(left[j] ?? {}, right[j] ?? {});
      }
    }
  } else entries.push(...groups.flat());
  entries.push(
    ...report.media
      .filter((m) => !m.reportPointId && m.sectionKey !== 'drawing')
      .map((image) => ({ point: undefined, image })),
  );
  let html = '';
  for (let i = 0; i < entries.length; i += 2) {
    const pair = entries.slice(i, i + 2);
    const single = mode === 'RDO' && pair.length === 1;
    const cells = (single ? [0] : [0, 1])
      .map((j) => {
        const entry = pair[j];
        if (!entry || (!entry.point && !entry.image))
          return '<div class="reference-photo-cell"></div>';
        const data = (entry.point?.data ?? {}) as Record<string, unknown>;
        return `<div class="reference-photo-cell">${entry.point ? `<div class="reference-photo-tab">${mode === 'LP' ? 'SOLDA' : 'PONTO'} Nº: <span>${escape(entry.point.number)}</span></div><div class="reference-photo-tab">DESCONT.: <span>${escape(String(data.discontinuity || '—').slice(0, 50))}</span> · ACEITÁVEL: <span>${acceptable(data)}</span></div>` : ''}<div class="reference-photo-image">${entry.image ? `<img src="${images.get(entry.image.id) || ''}">` : 'Sem foto anexada'}</div></div>`;
      })
      .join('');
    html += `<div class="reference-photo-row">${band('IMAGENS DO ENSAIO')}<div class="reference-photo-columns ${single ? 'reference-single-photo' : ''}">${cells}</div></div>`;
    for (const entry of pair) {
      if (entry.image?.caption)
        html += annotations(
          entry.image.caption,
          entry.point
            ? 'Ponto ' + entry.point.number
            : 'Foto adicional ' + (i + pair.indexOf(entry) + 1),
        );
      if (entry.point) {
        const notes = pointNotes(entry.point);
        if (notes) html += annotations(notes, 'Ponto ' + entry.point.number);
        const d = entry.point.data as Record<string, unknown>;
        if (String(d.discontinuity || '').length > 50)
          html += annotations(d.discontinuity, 'Descontinuidade · ponto ' + entry.point.number);
      }
    }
  }
  return html;
}

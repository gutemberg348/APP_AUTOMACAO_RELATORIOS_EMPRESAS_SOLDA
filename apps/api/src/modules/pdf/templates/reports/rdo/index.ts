import { drawingImageSources, isEmbeddedDrawingImage } from '../layout';
import { signatureImage } from '../layout';
import { drawingDataSchema, drawingSvg, drawingNotesSvg } from '@weldcosta/shared';
import {
  sheet,
  photoRows,
  chunks,
  annotations,
  escape,
  displayDate,
  type PdfReport,
} from '../reference-layout';

export function render(report: PdfReport, images: Map<string, string>) {
  const data = report.specificData as Record<string, unknown>;
  const fields = [
    [
      ['CLIENTE', 'client'],
      ['MATERIAL', 'material'],
      ['TIPO DE SOLDA', 'weldType'],
    ],
    [
      ['OBRA', 'work'],
      ['GÁS PURGA', 'purgeGas'],
      ['TIPO DE INSPEÇÃO', 'inspectionType'],
    ],
    [
      ['FÁBRICA', 'factory'],
      ['DIÂMETRO', 'diameter'],
    ],
  ];
  const overflow: string[] = [];
  const summary = (raw: unknown, label: string) => {
    const text = String(raw ?? '') || '—';
    if (text.length > 80) overflow.push(annotations(text, label));
    return escape(text.length > 80 ? text.slice(0, 80) + '…' : text);
  };
  const info = `<div class="rdo-repeated"><table class="reference-table"><tbody><tr><th>DATA</th><td>${data.date ? displayDate(String(data.date)) : displayDate(report.reportDate)}</td><th>INSPETOR</th><td>${summary(data.inspector, 'Inspetor')}</td><th>VISTO</th><td>${summary(data.visa, 'Visto')}</td></tr>${fields.map((row) => `<tr>${row.map(([label, key]) => `<th>${label}</th><td>${summary(data[key!], label!)}</td>`).join('')}${row.length < 3 ? '<th></th><td></td>' : ''}</tr>`).join('')}</tbody></table></div>`;
  let content = overflow.join('');
  // A daily report has no cover or separate verdict page.
  for (const drawing of report.drawings) {
    const cad = drawingDataSchema.parse(drawing.data);
    content +=
      `<div class="rdo-drawing">${drawingSvg(
        cad,
        report.points.map((p) => ({
          id: p.id,
          number: p.number,
          data: (p.data ?? {}) as { acceptable?: boolean },
        })),
        { images: drawingImageSources(report, images) },
      )}</div>` + annotations(cad.title + ' · Rev. ' + cad.revision);
    if (cad.notes) content += annotations(cad.notes);
    if (cad.notesDrawing?.elements.length)
      content += `<section class="drawing-notes" style="height:64mm;padding:0 3mm"><b>OBSERVAÇÕES</b><div style="height:58mm">${drawingNotesSvg(cad)}</div></section>`;
  }
  for (const m of report.media.filter(
    (m) => m.sectionKey === 'drawing' && !m.reportPointId && !isEmbeddedDrawingImage(m),
  ))
    content +=
      `<div class="rdo-drawing"><img src="${images.get(m.id) || ''}"></div>` +
      (m.caption ? annotations(m.caption) : '');
  content += photoRows(report, images, 'RDO');
  content += chunks(data.observation)
    .map(
      (part, i) =>
        `<div class="rdo-observation"><b>OBS${i ? ' (continuação)' : ''}:</b><br>${escape(part || '—')}</div>`,
    )
    .join('');
  for (const signer of report.signatures) {
    content +=
      `<div class="evs-signers"><div class="evs-signer"><div class="evs-signature-space">${signatureImage(report, signer)}</div>` +
      annotations(
        [
          signer.name,
          signer.registrationNumber,
          signer.signedAt ? displayDate(signer.signedAt) : '',
        ]
          .filter(Boolean)
          .join(' · '),
        {
          INSPECTOR: 'Inspetor',
          TECHNICAL_RESPONSIBLE: 'Responsável técnico',
          REVIEWER: 'Revisor',
          CLIENT: 'Cliente',
          OTHER: 'Responsável',
        }[signer.role],
      ) +
      '</div></div>';
  }
  return sheet(report, 'RELATÓRIO DIÁRIO DE INSPEÇÃO', content, true, 'rdo-sheet').replace(
    '<main class="evs-flow">',
    info + '<main class="evs-flow">',
  );
}

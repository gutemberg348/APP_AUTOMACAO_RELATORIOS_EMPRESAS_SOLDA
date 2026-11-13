import {
  photoAnnotationsSchema,
  isHydrostaticTestPhoto,
  measurementPhotoDefaults,
} from '@weldcosta/shared';
import {
  cover,
  identification,
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
    ]);
  type Group = { label: string; points: PdfReport['points']; photos: PdfReport['media'] };
  const groups: Group[] = [];
  for (const point of report.points) {
    const label = point.label?.trim() || '';
    let group = label ? groups.find((g) => g.label === label) : undefined;
    if (!group) {
      group = { label, points: [], photos: [] };
      groups.push(group);
    }
    group.points.push(point);
    group.photos.push(
      ...report.media.filter((m) => m.reportPointId === point.id && isHydrostaticTestPhoto(m)),
    );
  }
  const general = report.media.filter((m) => !m.reportPointId && isHydrostaticTestPhoto(m));
  if (general.length) groups.push({ label: '', points: [], photos: general });
  let content = data.equipment ? annotations(data.equipment, 'EQUIPAMENTO') : '';
  const cards: { photoIndex: number; offset: number; support: boolean; html: string }[] = [];
  for (const group of groups) {
    const first = (group.points[0]?.data ?? {}) as Record<string, unknown>;
    const thickness = String(first.projectThickness || data.projectThickness || '').trim();
    const legacyRows = group.points
      .filter(
        (p) =>
          p.value != null ||
          typeof (p.data as Record<string, unknown> | null)?.acceptable === 'boolean',
      )
      .map((p) => {
        const d = (p.data ?? {}) as Record<string, unknown>;
        return `<div class="measurement-reading">PONTO ${escape(p.number)}${p.value != null ? `: <span>${escape(p.value.toLocaleString('pt-BR', { maximumFractionDigits: 20 }))} ${escape(p.unit || 'mm')}</span>` : ''}${typeof d.acceptable === 'boolean' ? ` · ACEITÁVEL: ${acceptable(d)}` : ''}</div>`;
      });
    const firstPhotoAnnotations = group.photos[0]?.annotations
      ? photoAnnotationsSchema.parse(group.photos[0].annotations)
      : undefined;
    const separateLegacy =
      firstPhotoAnnotations?.measurements !== undefined && legacyRows.length > 0;
    if (separateLegacy) {
      // Photo-specific readings supplement the report's existing measurements.
      // Do not silently discard those when the photo switches to the new editor.
      for (let offset = 0; offset < legacyRows.length; offset += 6) {
        content += `<div class="measurement-block">${band('Leituras do cadastro · ' + group.label.slice(0, 80))}${thickness ? `<div class="reference-photo-tab">ESPESSURA DE PROJETO: <span>${escape(thickness.slice(0, 50))}</span></div>` : ''}${legacyRows.slice(offset, offset + 6).join('')}</div>`;
      }
    }
    // Empty drawing-generated points do not create empty photo cards.
    if (!group.photos.length && !legacyRows.length) {
      for (const point of group.points) {
        const d = (point.data ?? {}) as Record<string, unknown>;
        const info = [
          point.label,
          d.notes,
          d.dimension,
          d.projectThickness,
          d.discontinuity && d.discontinuity !== '-' ? d.discontinuity : '',
        ]
          .filter(Boolean)
          .join(' · ');
        if (info) content += annotations(info, 'Registro ' + point.number);
      }
      continue;
    }
    // Each photo owns its measurements. Additional evidence does not inherit empty rows.
    for (let index = 0; index < Math.max(1, group.photos.length); index++) {
      const media = group.photos[index];
      const parsed = media?.annotations
        ? photoAnnotationsSchema.parse(media.annotations)
        : undefined;
      const details = {
        ...(index === 0 ? measurementPhotoDefaults(group.points[0], data.projectThickness) : {}),
        ...parsed?.measurementDetails,
      };
      const photoThickness = String(details.projectThickness ?? data.projectThickness ?? '').trim();
      for (const [label, text] of [
        ['Lado', details.side],
        ['Descontinuidade', details.discontinuity],
        ['Espessura de projeto', photoThickness],
      ]) {
        if (text && text.length > 80) content += annotations(text, label);
      }
      const rows =
        parsed?.measurements !== undefined
          ? parsed.measurements
              .filter((m) => m.value != null)
              .map(
                (m) =>
                  `<div class="measurement-reading">PONTO ${escape(m.number)}: <span>${escape(m.value!.toLocaleString('pt-BR', { maximumFractionDigits: 20 }))} mm</span></div>`,
              )
          : index === 0
            ? legacyRows
            : [];
      const showHeader =
        !!rows.length ||
        !!details.side ||
        !!details.discontinuity ||
        typeof details.acceptable === 'boolean';
      const result = details.acceptable == null ? '' : details.acceptable ? 'SIM' : 'NÃO';
      for (let offset = 0; offset < Math.max(1, rows.length); offset += 5) {
        cards.push({
          photoIndex: index,
          offset,
          support: !showHeader && !rows.length,
          html: `<div class="measurement-cell${rows.length ? ' measurement-with-readings' : ''}">${showHeader ? `<div class="reference-photo-tab">LADO: <span>${escape(String(details.side ?? group.label).slice(0, 80))}${offset ? ' (continuação)' : ''}</span></div><div class="measurement-metadata"><div>DESCONT.: <span>${escape(String(details.discontinuity ?? '').slice(0, 80))}</span></div><div>ACEITÁVEL: <span>${result}</span></div></div>` : ''}${media ? `<div class="measurement-photo report-photo-frame"><img alt="Imagem do ensaio" src="${images.get(media.id) || ''}"></div>` : ''}${rows.length ? `<div class="reference-photo-tab">PONTOS</div><div class="measurement-metadata"><div>ESPESSURA DE PROJETO: <span>${escape(photoThickness.slice(0, 80))}</span></div><div>ACEITÁVEL: <span>${result}</span></div></div>` : ''}${rows.slice(offset, offset + 5).join('')}</div>`,
        });
      }
    }
    if (group.label.length > 80) content += annotations(group.label, 'Lado / identificação');
    for (const m of group.photos) if (m.caption) content += annotations(m.caption, group.label);
    for (const p of group.points) {
      const d = (p.data ?? {}) as Record<string, unknown>;
      const notes = [
        d.notes,
        d.dimension ? 'Dimensão: ' + d.dimension : '',
        d.projectThickness &&
        (String(d.projectThickness).length > 50 ||
          String(d.projectThickness).trim() !== thickness ||
          !legacyRows.length)
          ? 'Espessura de projeto: ' + d.projectThickness
          : '',
        d.discontinuity &&
        (String(d.discontinuity).length > 50 ||
          String(d.discontinuity).trim() !== String(first.discontinuity || '').trim())
          ? 'Descontinuidade: ' + d.discontinuity
          : '',
      ]
        .filter(Boolean)
        .join(' · ');
      if (notes) content += annotations(notes, 'Ponto ' + p.number);
    }
  }
  cards.sort((a, b) => a.photoIndex - b.photoIndex || a.offset - b.offset);
  for (let i = 0; i < cards.length; i += 2) {
    content += `<div class="measurement-block">${cards[i]!.support && (!cards[i + 1] || cards[i + 1]!.support) ? '' : band('IMAGENS DO ENSAIO')}<div class="measurement-columns">${cards[i]!.html}${cards[i + 1]?.html ?? '<div class="measurement-cell"></div>'}</div></div>`;
  }
  if (content)
    html += sheet(report, 'PARTE DO EQUIPAMENTO<br>OU LINHA', content, true, 'measurement-sheet');
  return (
    html +
    conclusion(report, data.finalReport, ['TÉCNICO INSPEÇÃO', 'INSPETOR', 'CLIENTE'], true).replace(
      'reference-final',
      'reference-final measurement-sheet',
    )
  );
}

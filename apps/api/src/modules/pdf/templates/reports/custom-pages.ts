import {
  customReportPages,
  customPhotoPrefix,
  isCustomPagePhoto,
  drawingSvg,
  newDrawingData,
  type CustomReportPage,
} from '@weldcosta/shared';
import { sheet, annotations, escape, type PdfReport } from './reference-layout';
import { drawingImageSources } from './layout';

function renderCustomPage(report: PdfReport, page: CustomReportPage, images: Map<string, string>) {
  const title =
    page.title ||
    {
      blank: 'PÁGINA PERSONALIZADA',
      drawing: 'DESENHO',
      photos: 'IMAGENS DO ENSAIO',
      points: 'PONTOS DO ENSAIO',
    }[page.kind];
  if (page.kind === 'drawing' || page.kind === 'blank') {
    return (
      page.drawings.length
        ? page.drawings
        : [{ data: { ...newDrawingData(), grid: 'none' as const, page: 'portrait' as const } }]
    )
      .map((drawing) =>
        sheet(
          report,
          escape(title),
          `<div class="custom-drawing">${drawingSvg(
            { ...drawing.data, notes: '', notesDrawing: undefined },
            page.points.map((p) => ({ clientId: p.key, number: p.number })),
            {
              images: drawingImageSources(report, images),
              centerContent: true,
              pointStatusColors: false,
            },
          )}</div>`,
          true,
          'custom-report-sheet custom-drawing-sheet',
        ),
      )
      .join('');
  }
  const entries: { media?: PdfReport['media'][number]; heading: string }[] = [];
  const generalPhotos = report.media.filter((m) =>
    (m.clientUploadId ?? m.id).startsWith(customPhotoPrefix(page.id)),
  );
  if (page.kind === 'photos')
    entries.push(...generalPhotos.map((media) => ({ media, heading: '' })));
  else
    for (const point of page.points) {
      const heading = [
        `PONTO / SOLDAS: ${point.number || '—'}`,
        point.label,
        point.reading ? 'LEITURA / DIMENSÃO: ' + point.reading : '',
        point.discontinuity ? 'DESCONT.: ' + point.discontinuity : '',
        point.acceptable == null ? '' : 'ACEITÁVEL: ' + (point.acceptable ? 'SIM' : 'NÃO'),
      ]
        .filter(Boolean)
        .join(' · ');
      const photos = report.media.filter((m) =>
        (m.clientUploadId ?? m.id).startsWith(customPhotoPrefix(page.id, point.key)),
      );
      entries.push(
        ...(photos.length ? photos.map((media) => ({ media, heading })) : [{ heading }]),
      );
    }
  if (!entries.length) return ''; // An unused optional page never reserves a blank sheet.
  const columns = page.photosPerPage === 1 || page.photosPerPage === 3 ? 1 : 2;
  const rows = Math.ceil(page.photosPerPage / columns);
  let html = '';
  for (let i = 0; i < entries.length; i += page.photosPerPage) {
    const cells = entries
      .slice(i, i + page.photosPerPage)
      .map(
        ({ media, heading }) =>
          `<figure class="custom-photo-cell">${heading ? `<div class="custom-point-heading">${escape(heading.length > 180 ? heading.split(' · ')[0] : heading)}</div>` : ''}<div class="custom-photo-image">${media ? `<img alt="Foto do ensaio" src="${images.get(media.id) || ''}">` : '<span>SEM FOTO ANEXADA</span>'}</div>${media?.caption && media.caption.length <= 120 ? `<figcaption>${escape(media.caption)}</figcaption>` : ''}</figure>`,
      )
      .join('');
    html += sheet(
      report,
      escape(title),
      `<div class="custom-photo-grid" style="--custom-columns:${columns};--custom-rows:${rows}">${cells}</div>`,
      true,
      'custom-report-sheet custom-photo-sheet',
    );
  }
  const longCaptions = entries.filter((e) => e.media?.caption && e.media.caption.length > 120);
  const longHeadings = [
    ...new Set(entries.filter((e) => e.heading.length > 180).map((e) => e.heading)),
  ];
  if (longCaptions.length || longHeadings.length)
    html += sheet(
      report,
      escape(title),
      longHeadings.map((heading) => annotations(heading, 'Dados do ponto')).join('') +
        longCaptions
          .map((entry) => annotations(entry.media!.caption, entry.heading || 'Legenda da foto'))
          .join(''),
      true,
      'custom-report-sheet',
    );
  return html;
}

/** Keep custom attachments outside the built-in templates and preserve their chosen order. */
export function renderWithCustomPages(
  report: PdfReport,
  images: Map<string, string>,
  template: (report: PdfReport, images: Map<string, string>) => string,
) {
  const pages = customReportPages(report.specificData);
  const normal = template(
    { ...report, media: report.media.filter((m) => !isCustomPagePhoto(m)) },
    images,
  );
  const extra = pages
    .map((page) =>
      renderCustomPage(report, page, images).replace(
        /<article /g,
        `<article data-custom-id="${page.id}" data-custom-position="${page.position}" data-custom-after="${page.afterPage ?? 1}" `,
      ),
    )
    .join('');
  return normal + extra || sheet(report, 'RELATÓRIO', '', true);
}

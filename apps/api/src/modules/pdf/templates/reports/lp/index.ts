import {
  cover,
  identification,
  drawings,
  photoRows,
  sheet,
  conclusion,
  escape,
  type PdfReport,
} from '../reference-layout';
import { lpTechnical } from './technical';

/** Optional, independent evidence: three photos on each sheet, after all drawings. */
export function testPhotoSheets(report: PdfReport, images: Map<string, string>) {
  const photos = report.media.filter((media) => media.sectionKey === 'test-photos');
  let html = '';
  for (let offset = 0; offset < photos.length; offset += 3) {
    html += sheet(
      report,
      'FOTOS DO ENSAIO',
      photos
        .slice(offset, offset + 3)
        .map(
          (photo) =>
            `<figure class="lp-test-photo"><div class="lp-test-photo-image"><img alt="${escape(photo.caption || 'Foto do ensaio')}" src="${images.get(photo.id) || ''}"></div>${photo.caption ? `<figcaption>${escape(photo.caption)}</figcaption>` : ''}</figure>`,
        )
        .join(''),
      true,
      'lp-test-photos',
    );
  }
  return html;
}

export function render(report: PdfReport, images: Map<string, string>) {
  let html =
    cover(report) +
    identification(report, [
      ['PROPRIETÁRIO', 'owner'],
      ['OBRA', 'work'],
      ['PROJETO', 'project'],
      ['PROCEDIMENTO / REVISÃO', 'procedureRevision'],
      ['ENSAIO', 'inspectionType'],
      ['PROCESSO DE SOLDAGEM', 'weldingProcess'],
      ['METAL DE BASE', 'baseMetal'],
      ['METAL DE ADIÇÃO', 'fillerMetal'],
      ['CHANFRO', 'bevel'],
      ['GÁS DE PURGA', 'purgeGas'],
      ['CRITÉRIO DE ACEITAÇÃO', 'acceptanceCriteria'],
      ['NORMA DE REF.', 'referenceStandard'],
    ]) +
    drawings(report, images) +
    testPhotoSheets(report, images);
  const photos = photoRows(report, images, 'LP');
  if (photos) html += sheet(report, 'SOLDA', photos);
  const data = report.specificData as Record<string, unknown>;
  html += sheet(report, 'DADOS GERAIS', lpTechnical(data), false, 'lp-technical');
  return html + conclusion(report, data.finalReport);
}

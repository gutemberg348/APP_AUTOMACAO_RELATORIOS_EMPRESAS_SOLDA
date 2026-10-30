import {
  cover,
  identification,
  drawings,
  photoRows,
  sheet,
  conclusion,
  type PdfReport,
} from '../reference-layout';
import { lpTechnical } from './technical';

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
    drawings(report, images);
  const photos = photoRows(report, images, 'LP');
  if (photos) html += sheet(report, 'SOLDA', photos);
  const data = report.specificData as Record<string, unknown>;
  html += sheet(report, 'DADOS GERAIS', lpTechnical(data), false, 'lp-technical');
  return html + conclusion(report, data.finalReport);
}

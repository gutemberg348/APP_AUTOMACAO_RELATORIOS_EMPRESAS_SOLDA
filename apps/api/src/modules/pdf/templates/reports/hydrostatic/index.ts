import { isHydrostaticTestPhoto } from '@weldcosta/shared';
import {
  cover,
  identification,
  sheet,
  band,
  annotations,
  escape,
  conclusion,
  displayDate,
  value,
  titles,
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
      ['DESENHO DE REFERÊNCIA', 'referenceDrawing'],
      ['NORMA DO MATERIAL', 'materialStandard'],
      ['PROCEDIMENTO / REVISÃO', 'procedureRevision'],
      ['ART Nº', 'artNumber'],
      ['NORMA DE REFERÊNCIA', 'referenceStandard'],
    ]);
  const fields = (items: [string, unknown][], caption = '', joined = false) => {
    const overflow: string[] = [];
    const cells = items
      .map(([label, raw]) => {
        const text = String(raw ?? '').trim() || '—';
        if (text.length > 110) overflow.push(annotations(text, label));
        return `<div class="th-field"><b>${escape(label)}:</b><div>${escape(text.length > 110 ? text.slice(0, 110) + '…' : text)}</div></div>`;
      })
      .join('');
    return (
      `<div class="th-fields${joined ? ' th-fields-joined' : ''}">${caption ? band(caption) : ''}<div class="th-field-grid" style="grid-template-columns:repeat(${items.length},minmax(0,1fr))">${cells}</div></div>` +
      overflow.join('')
    );
  };
  const row = (items: [string, string][], caption = '', joined = false) =>
    fields(
      items.map(([label, path]) => [label, value(data, path)]),
      caption,
      joined,
    );
  let technical = row([
    ['CLIENTE', 'client'],
    ['PROCEDIMENTO / REVISÃO', 'procedureRevision'],
  ]);
  technical += row([
    ['PROJETO', 'project'],
    ['NORMA DE REFERÊNCIA', 'referenceStandard'],
  ]);
  technical += row([
    ['FLUIDO DO TESTE', 'testFluid'],
    ['ART Nº', 'artNumber'],
  ]);
  const date = value(data, 'manometer.calibrationDate');
  technical += fields(
    [
      ['FABRICANTE', value(data, 'manometer.manufacturer')],
      ['CERTIFICADO Nº', value(data, 'manometer.certificateNumber')],
      ['DATA DA AFERIÇÃO', date ? displayDate(String(date)) : ''],
      ['SÉRIE Nº', value(data, 'manometer.serialNumber')],
    ],
    'MANÔMETRO',
  );
  technical += row(
    [
      ['TEMP. DE TRAB.', 'generalData.workingTemperature'],
      ['PRESSÃO DE TRAB.', 'generalData.workingPressure'],
      ['PRESSÃO DO TESTE', 'generalData.testPressure'],
      ['DURAÇÃO DO TESTE', 'generalData.testDuration'],
    ],
    'DADOS GERAIS',
  );
  technical += row(
    [
      ['EQUIPAMENTO', 'generalData.equipment'],
      ['MATERIAL', 'generalData.material'],
      ['ESPESSURA', 'generalData.thickness'],
      ['DIMENSÃO', 'generalData.dimension'],
    ],
    '',
    true,
  );
  if (value(data, 'generalData.manufacturer'))
    technical += row([['FABRICANTE DO EQUIPAMENTO', 'generalData.manufacturer']], '', true);
  html += sheet(report, titles.TH!, technical, false, 'th-technical');
  html += hydrostaticPhotoSheets(report, images);
  return (
    html +
    conclusion(
      report,
      data.observation,
      ['TÉCNICO INSPEÇÃO', 'ENG. MECÂNICO', 'CLIENTE'],
      false,
      true,
    )
  );
}

/** Six real images per sheet. Empty legacy points never reserve a photo slot. */
export function hydrostaticPhotoSheets(report: PdfReport, images: Map<string, string>) {
  const photos = report.media.filter(isHydrostaticTestPhoto);
  let html = '';
  for (let offset = 0; offset < photos.length; offset += 6) {
    const page = photos.slice(offset, offset + 6);
    let rows = '';
    for (let i = 0; i < page.length; i += 2) {
      const cells = [page[i], page[i + 1]]
        .map(
          (photo) =>
            `<figure class="th-test-photo">${photo ? `<div class="th-test-photo-image"><img alt="${escape(photo.caption || 'Imagem do ensaio')}" src="${images.get(photo.id) || ''}"></div>${photo.caption ? `<figcaption>${escape(photo.caption)}</figcaption>` : ''}` : ''}</figure>`,
        )
        .join('');
      rows += `<div class="th-test-photo-row">${band('IMAGENS DO ENSAIO')}<div class="th-test-photo-columns">${cells}</div></div>`;
    }
    html += sheet(report, titles.TH!, rows, false, 'th-test-photos');
  }
  return html;
}

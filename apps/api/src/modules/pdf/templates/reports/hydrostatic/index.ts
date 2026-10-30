import {
  cover,
  identification,
  drawings,
  photoRows,
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
  html += drawings(report, images);
  const photos = photoRows(report, images, 'TH');
  if (photos) html += sheet(report, titles.TH!, photos);
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

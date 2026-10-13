import {
  cover,
  identification,
  drawings,
  photoRows,
  sheet,
  fieldMatrix,
  matrix,
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
  let technical = fieldMatrix(data, [
    ['CLIENTE', 'client'],
    ['PROCEDIMENTO / REVISÃO', 'procedureRevision'],
  ]);
  technical += fieldMatrix(data, [
    ['PROJETO', 'project'],
    ['NORMA DE REFERÊNCIA', 'referenceStandard'],
  ]);
  technical += fieldMatrix(data, [
    ['FLUIDO DO TESTE', 'testFluid'],
    ['ART Nº', 'artNumber'],
  ]);
  const date = value(data, 'manometer.calibrationDate');
  technical += matrix(
    ['FABRICANTE', 'CERTIFICADO Nº', 'DATA DA AFERIÇÃO', 'SÉRIE Nº'],
    [
      [
        value(data, 'manometer.manufacturer'),
        value(data, 'manometer.certificateNumber'),
        date ? displayDate(String(date)) : '',
        value(data, 'manometer.serialNumber'),
      ],
    ],
    'MANÔMETRO',
  );
  technical += fieldMatrix(
    data,
    [
      ['TEMP. DE TRAB.', 'generalData.workingTemperature'],
      ['FABRICANTE', 'generalData.manufacturer'],
      ['PRESSÃO DE TRAB.', 'generalData.workingPressure'],
      ['DURAÇÃO DO TESTE', 'generalData.testDuration'],
    ],
    'DADOS GERAIS',
  );
  technical += fieldMatrix(data, [
    ['EQUIPAMENTO', 'generalData.equipment'],
    ['MATERIAL', 'generalData.material'],
    ['ESPESSURA', 'generalData.thickness'],
    ['DIMENSÃO', 'generalData.dimension'],
  ]);
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

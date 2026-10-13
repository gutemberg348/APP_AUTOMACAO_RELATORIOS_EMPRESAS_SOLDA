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
  type PdfReport,
} from '../reference-layout';

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
  let technical = fieldMatrix(data, [
    ['TEMPERATURA', 'generalData.temperature'],
    ['ESPESSURA', 'generalData.thickness'],
    ['CONDIÇÃO SUPERFICIAL', 'generalData.surfaceCondition'],
    ['INTENSIDADE DE ILUMINAÇÃO', 'generalData.lightingIntensity'],
    ['METAL DE BASE', 'generalData.baseMetal'],
  ]);
  technical += fieldMatrix(
    data,
    [
      ['TIPO DE PENETRANTE', 'penetrantType'],
      ['TÉCNICA DE REMOÇÃO', 'removalTechnique'],
    ],
    'MATERIAIS UTILIZADOS',
  );
  technical += matrix(
    ['', 'LIMPEZA (SOLVENTE)', 'PENETRANTE', 'REMOVEDOR', 'REVELADOR'],
    [
      ['FABRICANTE', 'manufacturer'],
      ['MARCA', 'brand'],
      ['LOTE', 'lot'],
      ['VALIDADE', 'expirationDate'],
    ].map(([label, key]) => [
      label,
      ...['cleaner', 'penetrant', 'remover', 'developer'].map((material) => {
        const v = value(data, `materials.${material}.${key}`);
        return key === 'expirationDate' && v ? displayDate(String(v)) : v;
      }),
    ]),
  );
  const indications = (data.discontinuities ?? []) as { code?: string; description?: string }[];
  for (let i = 0; i < Math.max(1, indications.length); i += 12)
    technical += matrix(
      ['CÓDIGO', 'DESCRIÇÃO'],
      indications.length
        ? indications.slice(i, i + 12).map((d) => [d.code, d.description])
        : Array.from({ length: 8 }, () => ['', '']),
      'DESCONTINUIDADES',
    );
  technical += matrix(
    ['', '', ''],
    [
      ['A - APROVADO', 'PO - PORO', 'SP - SOBREPOSIÇÃO'],
      ['R - REPROVADO', 'TR - TRINCA RAMIFICADA', 'FF - FALTA DE FUSÃO'],
      ['REC - RECOMENDAÇÃO', 'TL - TRINCA LONGITUDINAL', 'FP - FALTA DE PENETRAÇÃO'],
      ['COMPLETAR', 'TT - TRINCA TRANSVERSAL', 'MO - MORDEDURA'],
    ],
    'LEGENDA',
  );
  html += sheet(report, 'DADOS GERAIS', technical, false, 'lp-technical');
  return html + conclusion(report, data.finalReport);
}

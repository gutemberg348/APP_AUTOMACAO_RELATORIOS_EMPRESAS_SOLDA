export interface ReportField {
  path: string;
  label: string;
  kind?: 'date' | 'result' | 'long';
}
export interface ReportSection {
  title: string;
  fields: ReportField[];
}
const field = (path: string, label: string, kind?: ReportField['kind']): ReportField => ({
  path,
  label,
  kind,
});
const identity = [
  field('client', 'Cliente'),
  field('factory', 'Fábrica'),
  field('owner', 'Proprietário'),
  field('work', 'Obra'),
  field('project', 'Projeto'),
];
const welding = [
  field('procedureRevision', 'Procedimento / revisão'),
  field('inspectionType', 'Tipo de ensaio'),
  field('weldingProcess', 'Processo de soldagem'),
  field('baseMetal', 'Metal de base'),
  field('bevel', 'Chanfro'),
  field('purgeGas', 'Gás de purga'),
  field('acceptanceCriteria', 'Critério de aceitação'),
  field('referenceStandard', 'Norma de referência'),
];
const conclusion = {
  title: 'Laudo',
  fields: [
    field('finalReport', 'Laudo final', 'long'),
    field('finalResult', 'Resultado', 'result'),
  ],
};
export const reportSections: Record<string, ReportSection[]> = {
  EVS: [
    { title: 'Identificação', fields: identity },
    { title: 'Dados do ensaio', fields: welding },
    conclusion,
  ],
  EVD: [
    { title: 'Identificação', fields: identity },
    {
      title: 'Dados do ensaio',
      fields: [
        field('drawingReference', 'Desenho de referência / revisão'),
        ...welding.slice(0, 4),
        field('fillerMetal', 'Metal de adição'),
        ...welding.slice(4, 6),
        field('weldingSpecification', 'EPS / revisão'),
        ...welding.slice(6),
      ],
    },
    conclusion,
  ],
  LP: [
    { title: 'Identificação', fields: identity },
    { title: 'Dados do ensaio', fields: [...welding, field('fillerMetal', 'Metal de adição')] },
    {
      title: 'Dados gerais',
      fields: [
        field('generalData.temperature', 'Temperatura'),
        field('generalData.thickness', 'Espessura'),
        field('generalData.surfaceCondition', 'Condição superficial'),
        field('generalData.lightingIntensity', 'Intensidade de iluminação'),
        field('generalData.baseMetal', 'Metal de base'),
        field('inspectionArea', 'Área / linha inspecionada'),
      ],
    },
    {
      title: 'Materiais utilizados',
      fields: [
        field('penetrantType', 'Tipo de penetrante'),
        field('removalTechnique', 'Técnica de remoção'),
        ...[
          ['cleaner', 'Limpeza'],
          ['penetrant', 'Penetrante'],
          ['remover', 'Removedor'],
          ['developer', 'Revelador'],
        ].flatMap(([key, name]) => [
          field(`materials.${key}.manufacturer`, `${name} · fabricante`),
          field(`materials.${key}.brand`, `${name} · marca`),
          field(`materials.${key}.lot`, `${name} · lote`),
          field(`materials.${key}.expirationDate`, `${name} · validade`, 'date'),
        ]),
      ],
    },
    conclusion,
  ],
  TH: [
    {
      title: 'Identificação',
      fields: [
        field('client', 'Cliente'),
        field('location', 'Local'),
        ...identity.slice(2),
        field('referenceDrawing', 'Desenho de referência'),
        field('materialStandard', 'Norma do material'),
        field('procedureRevision', 'Procedimento / revisão'),
        field('artNumber', 'ART nº'),
        field('referenceStandard', 'Norma de referência'),
      ],
    },
    {
      title: 'Dados do teste',
      fields: [
        field('testFluid', 'Fluido do teste'),
        ...[
          ['workingTemperature', 'Temperatura de trabalho'],
          ['manufacturer', 'Fabricante'],
          ['workingPressure', 'Pressão de trabalho'],
          ['testPressure', 'Pressão do teste'],
          ['testDuration', 'Duração do teste'],
          ['equipment', 'Equipamento'],
          ['material', 'Material'],
          ['thickness', 'Espessura'],
          ['dimension', 'Dimensão'],
        ].map(([key, label]) => field(`generalData.${key}`, label!)),
      ],
    },
    {
      title: 'Manômetro',
      fields: [
        field('manometer.manufacturer', 'Fabricante'),
        field('manometer.certificateNumber', 'Certificado nº'),
        field('manometer.calibrationDate', 'Data de aferição', 'date'),
        field('manometer.serialNumber', 'Série nº'),
      ],
    },
    {
      title: 'Laudo',
      fields: [
        field('observation', 'Observação / laudo', 'long'),
        field('finalResult', 'Resultado', 'result'),
      ],
    },
  ],
  ME: [
    {
      title: 'Identificação',
      fields: [
        ...identity,
        field('drawing', 'Desenho de referência'),
        field('inspectionType', 'Ensaio'),
        field('projectThickness', 'Espessura de projeto'),
        field('baseMetal', 'Metal de base'),
        field('referenceStandard', 'Norma de referência'),
      ],
    },
    { title: 'Equipamento', fields: [field('equipment', 'Equipamento')] },
    conclusion,
  ],
  RDO: [
    {
      title: 'Dados',
      fields: [
        field('date', 'Data', 'date'),
        field('inspector', 'Inspetor'),
        field('client', 'Cliente'),
        field('work', 'Obra'),
        field('factory', 'Fábrica'),
        field('material', 'Material'),
        field('purgeGas', 'Gás de purga'),
        field('diameter', 'Diâmetro'),
        field('weldType', 'Tipo de solda'),
        field('inspectionType', 'Tipo de inspeção'),
      ],
    },
    {
      title: 'Observação',
      fields: [field('observation', 'Observação', 'long'), field('visa', 'Visto (opcional)')],
    },
  ],
};

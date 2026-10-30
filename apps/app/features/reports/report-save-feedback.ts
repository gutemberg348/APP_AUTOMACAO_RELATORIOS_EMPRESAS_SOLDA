import type { ReportSection } from './report-fields';
import type { ValidationIssue } from '../../utils/form-feedback';

export interface ReportCorrection {
  path: string[];
  label: string;
  message: string;
  guidance: string;
}
export interface CorrectionRequest extends ReportCorrection {
  request: number;
}

export function reportFormIssues(errors: unknown, path: string[] = []): ValidationIssue[] {
  if (!errors || typeof errors !== 'object') return [];
  const record = errors as Record<string, unknown>;
  if (typeof record.message === 'string')
    return [{ path, code: 'custom', message: record.message }];
  return Object.entries(record).flatMap(([key, child]) =>
    ['ref', 'type', 'types'].includes(key) ? [] : reportFormIssues(child, [...path, key]),
  );
}
const labels: Record<string, string> = {
  number: 'Número',
  title: 'Título',
  reportDate: 'Data do relatório',
  name: 'Nome',
  value: 'Leitura',
  unit: 'Unidade',
  dimension: 'Dimensão',
  signedAt: 'Data da assinatura',
  label: 'Identificação',
  discontinuity: 'Descontinuidade',
  acceptable: 'Aceitável',
  registrationNumber: 'Registro profissional',
  signatureAssetId: 'Assinatura',
  role: 'Função',
  notes: 'Observações',
  projectThickness: 'Espessura de projeto',
  points: 'Pontos',
  drawings: 'Desenhos',
  signatures: 'Responsáveis',
  elements: 'Elementos do desenho',
  notesDrawing: 'Folha de observações',
  color: 'Cor',
  strokeColor: 'Cor do traço',
  strokeWidth: 'Espessura do traço',
  fontSize: 'Tamanho do texto',
  text: 'Texto',
  code: 'Código',
  description: 'Descrição',
  discontinuities: 'Descontinuidades',
  revision: 'Revisão',
  photos: 'Fotos',
  mediaKey: 'Imagem',
  inspectionRecords: 'Registros de inspeção',
  item: 'Item',
  drawingReference: 'Desenho nº / revisão',
  diameter: 'Diâmetro',
  joint: 'Junta',
  rootStamp: 'Sinete da solda de raiz',
  finishStamp: 'Sinete da solda de acabamento',
  result: 'Laudo do registro',
};

export function reportCorrections(
  issues: ValidationIssue[],
  sections: ReportSection[],
  points: { number: string }[],
  specificData = false,
): ReportCorrection[] {
  const fields = sections.flatMap((s) => s.fields);
  return issues.map((issue) => {
    const path = issue.path.map(String);
    if (
      path[0] !== 'specificData' &&
      (specificData || fields.some((f) => f.path === path.join('.')))
    )
      path.unshift('specificData');
    const technical = fields.find((f) => 'specificData.' + f.path === path.join('.'));
    const key = path.at(-1) ?? '';
    const date = key === 'reportDate' || key === 'signedAt' || technical?.kind === 'date';
    const prefix = /^\d+$/.test(path[1] ?? '')
      ? path[0] === 'points'
        ? `Ponto ${points[Number(path[1])]?.number || Number(path[1]) + 1} · `
        : path[0] === 'signatures'
          ? `Responsável ${Number(path[1]) + 1} · `
          : path[0] === 'drawings'
            ? `Desenho ${Number(path[1]) + 1} · `
            : ''
      : path[0] === 'specificData' && path[1] === 'discontinuities' && /^\d+$/.test(path[2] ?? '')
        ? `Descontinuidade ${Number(path[2]) + 1} · `
        : path[0] === 'specificData' &&
            path[1] === 'inspectionRecords' &&
            /^\d+$/.test(path[2] ?? '')
          ? `Registro ${Number(path[2]) + 1} · `
          : '';
    const section = technical ? sections.find((s) => s.fields.includes(technical)) : undefined;
    const label =
      prefix + (technical?.label ?? labels[key] ?? labels[path[0] ?? ''] ?? 'Dados do relatório');
    const message = date ? 'Informe uma data válida em DD/MM/AAAA.' : issue.message;
    const guidance = date
      ? 'Digite dia, mês e ano, por exemplo 29/10/2026. Confira se a data existe.'
      : key === 'number'
        ? path[0] === 'points'
          ? 'Preencha o número deste ponto. Cada ponto deve ter um número diferente no relatório.'
          : 'Abra Identificação e informe o número usado para identificar este relatório, por exemplo 001.'
        : key === 'photos'
          ? 'Abra as fotos deste ponto. Envie novamente ou substitua a foto indicada, salve e tente baixar o PDF outra vez.'
          : key === 'mediaKey'
            ? 'Abra este desenho, confira a imagem indicada e conclua o desenho. Toque em Salvar e aguarde o envio antes de baixar o PDF.'
            : path[0] === 'specificData' && path[1] === 'discontinuities'
              ? 'Abra Descontinuidades e revise o código ou a descrição da linha indicada. O código aceita até 100 caracteres e a descrição até 10.000.'
              : path[0] === 'specificData' && path[1] === 'inspectionRecords'
                ? 'Abra Registros de inspeção e revise o item indicado. Confira o desenho, a junta e os sinetes; em Laudo escolha uma das opções disponíveis.'
                : path[0] === 'drawings'
                  ? 'Abra este desenho e ajuste o item indicado nas propriedades. Depois conclua o desenho e salve o relatório.'
                  : key === 'value'
                    ? 'Informe apenas uma leitura numérica válida, por exemplo 2,5. A unidade fica no campo Unidade.'
                    : key === 'acceptable'
                      ? 'Escolha Sim, Não ou Não informado na opção Aceitável do ponto.'
                      : issue.code === 'too_big'
                        ? 'Reduza o conteúdo ou a quantidade de itens até o limite informado acima.'
                        : issue.code === 'invalid_value'
                          ? 'Selecione uma das opções disponíveis neste campo.'
                          : path[0] === 'signatures'
                            ? 'Confira os dados deste responsável. Se a assinatura não estiver disponível, selecione a pessoa ou envie a assinatura novamente.'
                            : `Revise o campo ${technical?.label ?? labels[key] ?? 'indicado'}${section ? ' em ' + section.title : ''} e salve novamente.`;
    return { path, label, message, guidance };
  });
}

// Business errors do not always carry Zod paths. Only route codes with a known location.
export function reportBusinessCorrection(
  code: string,
  message: string,
): ReportCorrection | undefined {
  const cases: Record<string, [string, string, string]> = {
    DRAWING_IMAGE_PENDING: [
      'drawings',
      'Imagem do desenho pendente',
      'Abra o desenho indicado, confira a imagem e toque em Salvar para concluir o envio antes de baixar o PDF.',
    ],
    REPORT_MEDIA_UNAVAILABLE: [
      'points',
      'Foto indisponível',
      'Abra o ponto indicado e envie novamente a foto que não pôde ser carregada. Depois salve e gere o PDF.',
    ],
    INVALID_POINT: [
      'points',
      'Pontos do relatório',
      'Confira os pontos repetidos e seus números. Remova a cópia indevida e salve novamente.',
    ],
    AMBIGUOUS_POINT_NUMBER: [
      'points',
      'Número dos pontos',
      'Use um número diferente para cada ponto marcado no desenho.',
    ],
    POINT_HAS_PHOTOS: [
      'points',
      'Fotos do ponto removido',
      'Remova ou transfira as fotos do ponto antes de excluí-lo.',
    ],
    POINT_IN_DRAWING: [
      'drawings',
      'Marcação do ponto no desenho',
      'Remova a marcação correspondente no desenho antes de excluir o ponto.',
    ],
    INVALID_DRAWING: [
      'drawings',
      'Desenhos do relatório',
      'Confira se o desenho foi duplicado ou removido. Preserve suas edições antes de reabrir o relatório.',
    ],
    INVALID_DRAWING_POINT: [
      'drawings',
      'Ponto no desenho',
      'Confira os pontos marcados. Remova a marcação sem vínculo e posicione novamente um ponto cadastrado neste relatório.',
    ],
    INVALID_SIGNATURE: [
      'signatures',
      'Assinatura do responsável',
      'Selecione a pessoa ou envie a assinatura novamente em Responsáveis.',
    ],
  };
  const entry = cases[code];
  return entry ? { path: [entry[0]], label: entry[1], message, guidance: entry[2] } : undefined;
}

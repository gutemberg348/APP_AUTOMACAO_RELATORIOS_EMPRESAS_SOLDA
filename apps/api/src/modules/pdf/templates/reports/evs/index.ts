import { drawingDataSchema, drawingSvg } from '@weldcosta/shared';
import { escape, displayDate, signatureImage, type PdfReport } from '../layout';
import { referenceLogo } from './reference-logo';
import { evsStyles } from './styles';
import { referenceStyles } from '../reference-styles';

const title = 'RELATÓRIO DE ENSAIO<br>VISUAL DE SOLDAS';
const legend = [
  [
    'CR-CONCAVIDADE DE RAIZ',
    'CV-CONVEXIDADE',
    'FF-FALTA DE FUSÃO',
    'C-CONCAVIDADE',
    'FP-FALTA DE PENETRAÇÃO',
    'MF-MORDEDURA NA FACE',
    'MR-MORDEDURA NA RAIZ',
    'PS-PORO DE SUPERFÍCIE',
    'PR-POROSIDADE NA RAIZ',
    'PO-PORO',
    'PE-PENETRAÇÃO EXCESSIVA',
    'RC-RECHUPE DE CRATERA',
    'DS-DESCOLORAÇÃO DE SOLDA',
    'DZ-DESCOLORAÇÃO NA ZTA',
  ],
  [
    'RE-REINÍCIO POBRE',
    'DC-DESALINHAMENTO DE CORDÃO',
    'EC-ESTREITAMENTO DO CORDÃO',
    'DL-DESALINHAMENTO LINEAR',
    'DA-DEFORMAÇÃO ANGULAR',
    'R-RESPINGO',
    'T-TRINCA',
    'O-OXIDAÇÃO',
    'AA-ABERTURA DE ARCO',
    'DI-DEPOSIÇÃO INSUFICIENTE',
    'RE-REFORÇO EXCESSIVO',
    'S-SOBREPOSIÇÃO',
    'IM-INCLUSÃO METÁLICA',
    'ES-ESCÓRIA DE SOLIDIFICAÇÃO',
  ],
];

// Long editable text is split into printable blocks, never truncated.
export function chunks(value: unknown, size = 600) {
  const text = String(value ?? '').trim();
  if (!text) return [''];
  const result: string[] = [];
  let remaining = text;
  while (remaining.length > size) {
    const space = remaining.lastIndexOf(' ', size);
    const end = space > size / 2 ? space : size;
    result.push(remaining.slice(0, end));
    remaining = remaining.slice(end).trimStart();
  }
  if (remaining) result.push(remaining);
  return result;
}

export function header(report: PdfReport, heading: string) {
  return `<header class="evs-header"><div class="evs-logo"><img src="${referenceLogo}" alt="WELDCOSTA INSPEÇÕES INDUSTRIAIS"></div><div class="evs-heading">${heading}</div><table><tr><td>RELAT. Nº</td><td>${escape(report.number || 'Sem número')}</td></tr><tr><td>PÁGINA Nº</td><td class="evs-page-number"></td></tr><tr><td>DATA</td><td>${displayDate(report.reportDate).replace(/\/(\d{2})(\d{2})$/, '/$2')}</td></tr></table></header>`;
}
export const footer = `<footer class="evs-contact"><strong>WELDCOSTA INSPEÇÃO INDUSTRIAL LTDA</strong><br>Rua Saldanha Marinho, nº 451 Jd. Amanda II Hortolândia / SP<br>Fone: (19) 993106437 · site: www.weldcosta.com.br · e-mail: ednaldo@weldcosta.com.br</footer>`;

export function inspectionTitle(report: PdfReport) {
  const value = report.title?.trim() ?? '';
  const typeName = report.reportType.name || 'Ensaio Visual / Endoscopia';
  // Remove only the exact suggestion from the old form; preserve custom titles.
  return !value || value === report.project.name + ' · ' + typeName || value === typeName
    ? report.project.name
    : value;
}

export function render(report: PdfReport, images: Map<string, string>) {
  const data = report.specificData as Record<string, unknown>;
  const sheet = (heading: string, blocks: string, contact = false, className = '') =>
    `<article class="evs-sheet ${className}">${header(report, heading)}<main class="evs-flow">${blocks}</main>${contact ? footer : ''}</article>`;
  let html = sheet(
    title,
    ['client', 'factory']
      .map((key) =>
        chunks(data[key], 300)
          .map(
            (part, i) =>
              `<div class="evs-cover-block"><b>${key === 'client' ? 'CLIENTE' : 'FÁBRICA'}${i ? ' (continuação)' : ''}:</b><p>${escape(part || '—')}</p></div>`,
          )
          .join(''),
      )
      .join(''),
    true,
    'evs-cover',
  );
  const fields = [
    ['PROPRIETÁRIO', 'owner'],
    ['OBRA', 'work'],
    ['PROJETO', 'project'],
    ['PROCEDIMENTO / REVISÃO', 'procedureRevision'],
    ['ENSAIO', 'inspectionType'],
    ['PROCESSO DE SOLDAGEM', 'weldingProcess'],
    ['METAL DE BASE', 'baseMetal'],
    ['CHANFRO', 'bevel'],
    ['GÁS DE PURGA', 'purgeGas'],
    ['CRITÉRIO DE ACEITAÇÃO', 'acceptanceCriteria'],
    ['NORMA DE REF.', 'referenceStandard'],
  ];
  html += sheet(
    title,
    chunks(inspectionTitle(report))
      .map((part) => `<h1 class="evs-data-title">${escape(part)}</h1>`)
      .join('') +
      fields
        .map(([label, key]) =>
          chunks(data[key!])
            .map(
              (part, i) =>
                `<p class="evs-data-line"><b>${label}${i ? ' (continuação)' : ''}:</b> ${escape(part || '—')}</p>`,
            )
            .join(''),
        )
        .join(''),
    true,
  );
  for (const drawing of report.drawings) {
    const cad = drawingDataSchema.parse(drawing.data);
    html += sheet(
      'DESENHO',
      `<div class="evs-drawing">${drawingSvg(
        cad,
        report.points.map((p) => ({
          id: p.id,
          number: p.number,
          data: p.data as { acceptable?: boolean },
        })),
      )}</div><p class="evs-drawing-caption">${escape(cad.title)} · Rev. ${escape(cad.revision)} · Sem escala</p>` +
        (cad.notes
          ? chunks(cad.notes)
              .map((part) => `<p class="evs-annotation">${escape(part)}</p>`)
              .join('')
          : ''),
    );
  }
  for (const drawing of report.media.filter((m) => m.sectionKey === 'drawing' && !m.reportPointId))
    html += sheet(
      'DESENHO',
      `<div class="evs-drawing"><img src="${images.get(drawing.id) || ''}"></div>` +
        chunks(drawing.caption)
          .map((part) => `<p class="evs-annotation">${escape(part)}</p>`)
          .join(''),
    );
  const photoBlock = (point: PdfReport['points'][number] | null, pair: PdfReport['media']) => {
    const p = (point?.data ?? {}) as Record<string, unknown>;
    return `<div class="evs-weld"><table class="evs-weld-tab"><tr><th>${point ? 'SOLDA -' : 'FOTO ADICIONAL'}</th><td>${escape(point?.number ?? '')}</td><th>DIMENSÃO</th><td>${escape(String(p.dimension || '—').slice(0, 60))}</td></tr><tr><th>DESCONT.</th><td>${escape(String(p.discontinuity || '—').slice(0, 60))}</td><th>ACEITÁVEL</th><td>${p.acceptable === true ? 'SIM' : p.acceptable === false ? 'NÃO' : '—'}</td></tr></table><div class="evs-photo-pair">${[0, 1].map((i) => `<div>${pair[i] ? `<img src="${images.get(pair[i]!.id) || ''}" alt="Foto ${i + 1}">` : `<span>${!pair.length && i === 0 ? 'Sem foto anexada' : ''}</span>`}</div>`).join('')}</div></div>`;
  };
  if (report.points.length) {
    let blocks = '';
    for (const point of report.points) {
      const photos = report.media.filter((m) => m.reportPointId === point.id);
      for (let i = 0; i < Math.max(1, photos.length); i += 2) {
        const pair = photos.slice(i, i + 2);
        blocks += photoBlock(point, pair);
        for (const [index, media] of pair.entries()) {
          if (media.caption)
            blocks += chunks(media.caption)
              .map(
                (part) =>
                  `<p class="evs-annotation">Solda ${escape(point.number)} · Foto ${i + index + 1}: ${escape(part)}</p>`,
              )
              .join('');
        }
      }
      const p = point.data as Record<string, unknown>;
      const details = [
        point.label,
        p.notes,
        String(p.dimension || '').length > 60 ? 'Dimensão: ' + p.dimension : '',
        String(p.discontinuity || '').length > 60 ? 'Descontinuidade: ' + p.discontinuity : '',
        p.projectThickness ? 'Espessura de projeto: ' + p.projectThickness : '',
        point.value != null ? 'Leitura: ' + point.value + ' ' + (point.unit || '') : point.unit,
      ]
        .filter(Boolean)
        .join(' · ');
      if (details)
        blocks += chunks(details)
          .map(
            (part) =>
              `<p class="evs-annotation">Solda ${escape(point.number)}: ${escape(part)}</p>`,
          )
          .join('');
    }
    html += sheet('SOLDA', blocks);
  }
  const extras = report.media.filter((m) => !m.reportPointId && m.sectionKey !== 'drawing');
  if (extras.length) {
    let blocks = '';
    for (let i = 0; i < extras.length; i += 2) {
      const pair = extras.slice(i, i + 2);
      blocks += photoBlock(null, pair);
      for (const [j, media] of pair.entries())
        if (media.caption)
          blocks += chunks(media.caption)
            .map(
              (part) =>
                `<p class="evs-annotation">Foto adicional ${i + j + 1}: ${escape(part)}</p>`,
            )
            .join('');
    }
    html += sheet('FOTOS ADICIONAIS', blocks);
  }
  const used = new Set<string>();
  const signatureCell = (label: string, role: string) => {
    const signer = report.signatures.find((s) => s.role === role && !used.has(s.id));
    if (signer) used.add(signer.id);
    return `<div class="evs-signer"><div>${label}</div><div class="evs-signature-space">${signatureImage(report, signer)}</div><div class="evs-signature-name">${escape(signer?.name || (role === 'CLIENT' ? data.client : '') || '')}</div><div>${escape(signer?.registrationNumber || '')}</div><p>DATA: ${signer?.signedAt ? displayDate(signer.signedAt) : ''}</p></div>`;
  };
  const signers =
    signatureCell('INSPETOR', 'INSPECTOR') +
    signatureCell(
      'APROVADO POR',
      report.signatures.some((s) => s.role === 'TECHNICAL_RESPONSIBLE')
        ? 'TECHNICAL_RESPONSIBLE'
        : 'REVIEWER',
    ) +
    signatureCell('CLIENTE', 'CLIENT');
  let ending = chunks(data.finalReport)
    .map(
      (part, i) =>
        `<div class="evs-verdict ${i ? 'evs-verdict-continuation' : ''}">${escape(part || 'Laudo não informado.')}</div>`,
    )
    .join('');
  ending += `<div class="evs-legend"><h2>DESCONTINUIDADE</h2><div>${legend.map((col) => `<div>${col.map((text) => `<p>${text}</p>`).join('')}</div>`).join('')}</div></div>`;
  ending += `<div class="evs-signoff"><div class="evs-result">${[
    ['APPROVED', 'APROVADO'],
    ['REJECTED', 'REPROVADO'],
    ['COMPLEMENTARY_EXAM', 'EXAME COMPLEMENTAR'],
  ]
    .map(([value, label]) => `<b>${label} (${data.finalResult === value ? 'X' : ' '})</b>`)
    .join('')}</div><div class="evs-signers">${signers}</div></div>`;
  for (const signer of report.signatures.filter((s) => !used.has(s.id)))
    ending += `<div class="evs-signers">${signatureCell(signer.role === 'REVIEWER' ? 'REVISOR' : 'RESPONSÁVEL', signer.role)}</div>`;
  html += sheet('LAUDO FINAL', ending);
  return html;
}

export function evsDocumentHtml(body: string, final: boolean) {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><style>${evsStyles}${referenceStyles}
  .evs-sheet::after{content:${final ? "''" : "'PRÉVIA · SEM VALIDADE FINAL'"};position:absolute;bottom:1mm;right:2mm;font:7px Arial;color:#888;pointer-events:none}
  </style></head><body>${body}</body></html>`;
}

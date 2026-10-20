import { reportSections, drawingDataSchema, drawingSvg } from '@weldcosta/shared';
import type { Prisma } from '../../../../generated/prisma/client';
export type PdfReport = Prisma.ReportGetPayload<{
  include: {
    company: true;
    project: true;
    reportType: true;
    points: true;
    signatures: true;
    media: true;
    drawings: true;
  };
}> & { signatureImages?: Record<string, string> };
export function signatureImage(report: PdfReport, signer?: { id: string }) {
  const uri = signer ? report.signatureImages?.[signer.id] : undefined;
  return uri && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(uri)
    ? `<img alt="Assinatura" src="${uri}" style="width:100%;height:100%;object-fit:contain;display:block">`
    : '';
}
export const escape = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  );
export const displayDate = (value: string | Date | null) => {
  const iso = value instanceof Date ? value.toISOString() : value;
  return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '—';
};
const read = (data: unknown, path: string) =>
  path
    .split('.')
    .reduce<unknown>(
      (v, key) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[key] : undefined),
      data,
    );
export const resultLabels: Record<string, string> = {
  APPROVED: 'Aprovado',
  REJECTED: 'Reprovado',
  COMPLEMENTARY_EXAM: 'Exame complementar',
};
export const logo =
  '<svg width="165" height="40" viewBox="0 0 220 48" xmlns="http://www.w3.org/2000/svg"><path d="M1 24h48" stroke="#B42318" stroke-width="2"/><circle cx="25" cy="24" r="15" fill="white" stroke="#1764C0" stroke-width="3"/><circle cx="25" cy="24" r="9" fill="none" stroke="#112A47" stroke-width="2"/><text x="58" y="26" font-family="Arial" font-size="22" font-weight="bold" fill="#112A47">WELD<tspan fill="#1764C0">COSTA</tspan></text><text x="60" y="40" font-family="Arial" font-size="6.6" letter-spacing="2" fill="#5F7085">INSPEÇÕES INDUSTRIAIS</text></svg>';
export function reportHeader(report: PdfReport, logoImage: string) {
  const title =
    report.reportType.code === 'EVS'
      ? 'RELATÓRIO DE ENSAIO VISUAL DE SOLDAS'
      : report.reportType.name.toLocaleUpperCase();
  return `<div style="width:100%;padding:0 15mm;color:#111;font:10px Arial;box-sizing:border-box"><table style="width:100%;border-collapse:collapse;table-layout:fixed;border:2px solid #111"><tr><td rowspan="3" style="width:27%;border:1px solid #111;padding:8px;text-align:center"><img src="${logoImage}" style="width:100%;max-width:165px;height:auto"></td><td rowspan="3" style="width:42%;border:1px solid #111;padding:6px;text-align:center;font-size:14px;line-height:1.25;font-weight:bold">${escape(title)}</td><td style="width:17%;border:1px solid #111;padding:5px">RELAT. Nº</td><td style="width:14%;border:1px solid #111;padding:5px;text-align:center;color:#285580">${escape(report.number || 'Sem número')}</td></tr><tr><td style="border:1px solid #111;padding:5px">PÁGINA Nº</td><td style="border:1px solid #111;padding:5px;text-align:center;color:#285580"><span class="pageNumber"></span> / <span class="totalPages"></span></td></tr><tr><td style="border:1px solid #111;padding:5px">DATA</td><td style="border:1px solid #111;padding:5px;text-align:center;color:#285580">${displayDate(report.reportDate)}</td></tr></table></div>`;
}
function field(label: string, value: unknown) {
  return `<div class="field"><span>${escape(label)}</span><div>${escape(value === undefined || value === '' ? '—' : value)}</div></div>`;
}
function section(title: string, content: string, page = false) {
  return `<section class="${page ? 'new-page' : ''}"><h2>${escape(title)}</h2>${content}</section>`;
}
export function reportBody(report: PdfReport, images: Map<string, string>, code: string) {
  const data = report.specificData as Record<string, unknown>;
  const sections = reportSections[code] ?? [];
  let html =
    code === 'RDO'
      ? ''
      : `<section class="cover"><div class="kicker">${escape(report.reportType.name)}</div><h1>${escape(report.title || report.project.name)}</h1>${field('Cliente', data.client)}${field(code === 'TH' ? 'Local' : 'Fábrica', data[code === 'TH' ? 'location' : 'factory'])}${field('Obra', data.work)}<div class="cover-number">Relatório ${escape(report.number || 'Sem número')} · ${displayDate(report.reportDate)}</div></section>`;
  html += `<div class="${code === 'RDO' ? '' : 'new-page'}">`;
  for (const item of sections.filter(
    (item) => item.title !== 'Laudo' && item.title !== 'Observação',
  )) {
    html += section(
      item.title,
      `<div class="grid">${item.fields
        .map((item) => {
          const value = read(data, item.path);
          return field(
            item.label,
            item.kind === 'date' && value ? displayDate(String(value)) : value,
          );
        })
        .join('')}</div>`,
    );
  }
  html += '</div>';
  for (const [index, drawing] of report.drawings.entries()) {
    const cad = drawingDataSchema.parse(drawing.data);
    const points = report.points.map((point) => ({
      id: point.id,
      number: point.number,
      data: point.data as { acceptable?: boolean },
    }));
    html += section(
      'Desenho técnico · ' + String(index + 1).padStart(2, '0'),
      `<div class="cad-frame"><div class="cad-title"><strong>${escape(cad.title)}</strong><span>${cad.grid === 'isometric' ? 'ISOMÉTRICO' : cad.grid === 'orthogonal' ? 'VISTA ORTOGONAL' : 'CROQUI'} · SEM ESCALA</span></div><div class="cad-canvas">${drawingSvg(cad, points)}</div><div class="cad-stamp"><div>${field('Obra', data.work)}${field('Desenho / projeto', data.project || data.referenceDrawing || data.drawing)}</div><div>${field('Relatório', report.number)}${field('Revisão / prancha', cad.revision + ' / ' + (index + 1) + ' de ' + report.drawings.length)}</div></div></div><p class="cad-legend"><span>● Pendente</span><span>● Aceitável</span><span>● Não aceitável</span> · A numeração corresponde aos pontos e às evidências deste relatório.</p>${cad.notes ? field('Notas do desenho', cad.notes) : ''}`,
      true,
    );
  }
  if (report.points.length)
    html += section(
      code === 'ME' ? 'Pontos de medição' : 'Pontos / soldas',
      `<table><thead><tr><th>Nº</th><th>${code === 'ME' ? 'Lado / identificação' : 'Identificação'}</th><th>${code === 'ME' ? 'Leitura / unidade' : 'Dimensão'}</th><th>Descontinuidade</th><th>Aceitável</th><th>Observações</th></tr></thead><tbody>${report.points
        .map((point) => {
          const p = point.data as Record<string, unknown>;
          const sheets = report.drawings.flatMap((d, i) =>
            drawingDataSchema
              .parse(d.data)
              .elements.some((e) => e.type === 'point' && e.reportPointId === point.id)
              ? [i + 1]
              : [],
          );
          return `<tr><td><strong>${escape(point.number)}</strong>${sheets.length ? '<br><small>Prancha ' + sheets.join(', ') + '</small>' : ''}</td><td>${escape(point.label)}${p.projectThickness ? '<br>Projeto: ' + escape(p.projectThickness) : ''}</td><td>${code === 'ME' ? escape((point.value ?? '—') + ' ' + (point.unit ?? '')) : escape(p.dimension)}</td><td>${escape(p.discontinuity)}</td><td>${p.acceptable === true ? 'Sim' : p.acceptable === false ? 'Não' : '—'}</td><td>${escape(p.notes)}</td></tr>`;
        })
        .join('')}</tbody></table>`,
      true,
    );
  if (Array.isArray(data.discontinuities) && data.discontinuities.length)
    html += section(
      'Descontinuidades / legenda informada',
      `<table><thead><tr><th>Código</th><th>Descrição</th></tr></thead><tbody>${data.discontinuities.map((row: { code?: string; description?: string }) => `<tr><td>${escape(row.code)}</td><td>${escape(row.description)}</td></tr>`).join('')}</tbody></table>`,
    );
  for (const drawing of report.media.filter((media) => media.sectionKey === 'drawing'))
    html += section(
      'Desenho / croqui',
      `<figure class="drawing"><img src="${images.get(drawing.id)}"><figcaption>${escape(drawing.caption || drawing.originalName)}</figcaption></figure>`,
      true,
    );
  const photos = report.media.filter((media) => media.sectionKey !== 'drawing');
  if (photos.length) {
    const groups = [
      ...report.points.filter((p) => photos.some((m) => m.reportPointId === p.id)),
      null,
    ];
    let content = '';
    for (const point of groups) {
      const group = photos.filter((m) => m.reportPointId === (point?.id ?? null));
      if (!group.length) continue;
      const p = (point?.data ?? {}) as Record<string, unknown>;
      for (let offset = 0; offset < group.length; offset += 2) {
        const pair = group.slice(offset, offset + 2);
        content += `<div class="photo-group"><table class="photo-summary"><tbody><tr><th>${point ? (code === 'ME' ? 'MEDIÇÃO' : 'SOLDA') : 'REGISTRO GERAL'}</th><td>${point ? escape(point.number) : '—'}</td><th>${code === 'ME' ? 'LEITURA' : 'DIMENSÃO'}</th><td>${point ? escape(code === 'ME' ? (point.value ?? '—') + ' ' + (point.unit ?? '') : p.dimension || '—') : '—'}</td></tr>${point ? `<tr><th>DESCONT.</th><td>${escape(p.discontinuity || '—')}</td><th>ACEITÁVEL</th><td>${p.acceptable === true ? 'SIM' : p.acceptable === false ? 'NÃO' : 'NÃO INFORMADO'}</td></tr>` : ''}</tbody></table>${point?.label ? '<div class="photo-identification">' + escape(point.label) + '</div>' : ''}<div class="photos">${pair.map((media) => `<figure><img src="${images.get(media.id)}"><figcaption>${escape(media.caption || '')}</figcaption></figure>`).join('')}</div></div>`;
      }
    }
    html += section('Imagens do ensaio', content, code !== 'RDO');
  }
  for (const item of sections.filter(
    (item) => item.title === 'Laudo' || item.title === 'Observação',
  ))
    html += section(
      item.title,
      item.fields
        .map((item) => {
          const value = read(data, item.path);
          return item.kind === 'result'
            ? `<div class="result">Resultado: ${escape(resultLabels[String(value)] || 'Não informado')}</div>`
            : field(item.label, value);
        })
        .join(''),
      code !== 'RDO',
    );
  if (report.signatures.length)
    html += section(
      'Responsáveis',
      `<div class="signers">${report.signatures.map((signer) => `<div class="signer"><div class="signature-line"></div><strong>${escape(signer.name || 'Nome não informado')}</strong><p>${escape({ INSPECTOR: 'Inspetor', TECHNICAL_RESPONSIBLE: 'Responsável técnico', CLIENT: 'Cliente', REVIEWER: 'Revisor', OTHER: 'Outro' }[signer.role])}</p><p>${escape(signer.registrationNumber)}</p><p>Data: ${displayDate(signer.signedAt)}</p></div>`).join('')}</div><p class="note">Os nomes e registros identificam os responsáveis. Este documento não contém assinatura digital.</p>`,
    );
  return html;
}
export function documentHtml(body: string, final: boolean) {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><style>
  *{box-sizing:border-box}body{font:11px Arial,sans-serif;color:#1C2D41;margin:0;line-height:1.5}h1{font-size:29px;line-height:1.25;color:#112A47;overflow-wrap:anywhere}h2{font-size:15px;color:#112A47;border-left:3px solid #1764C0;padding:8px 12px;background:#EDF4FE;margin:0 0 15px;break-after:avoid}section{margin-bottom:24px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 20px}.field{border-bottom:1px solid #E2E8F0;padding:6px 0 10px;min-width:0;break-inside:avoid}.field span{font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:#5F7085;display:block;margin-bottom:4px}.field div{white-space:pre-wrap;overflow-wrap:anywhere}.cover{padding:50px 25px 20px;min-height:700px;display:flex;flex-direction:column;gap:28px}.cover .field div{font-size:18px}.kicker{text-transform:uppercase;letter-spacing:1px;color:#1764C0}.cover-number{margin-top:auto;border-top:2px solid #1764C0;padding-top:16px;color:#5F7085}.new-page{break-before:page}table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:10px}th,td{border:1px solid #D6DFEB;padding:9px;white-space:pre-wrap;overflow-wrap:anywhere;vertical-align:top}th{background:#EDF4FE;text-align:left}thead{display:table-header-group}tr{break-inside:avoid}.photos{display:flex;gap:0}.photos figure{width:50%;border-radius:0;padding:0;overflow:hidden;border:1px solid #333}.photos figure:only-child{width:100%}.photos figure img{height:145px;object-fit:contain;object-position:center}.photos figcaption{padding:5px}.photos figcaption:empty{display:none}figure{margin:0;border:1px solid #E2E8F0;border-radius:6px;padding:8px;break-inside:avoid}figure img{display:block;width:100%;height:220px;object-fit:contain}.drawing img{height:580px}figcaption{font-size:10px;padding-top:8px;overflow-wrap:anywhere}.result{padding:16px;background:#EDF4FE;border:1px solid #B9D3F5;font-size:15px;font-weight:bold;margin-top:20px}.signers{display:flex;flex-wrap:wrap;gap:18px}.signer{flex:1;min-width:130px;text-align:center;break-inside:avoid}.signature-line{border-bottom:1px solid #5F7085;height:45px;margin-bottom:10px}.signer p{margin:3px 0}.note{font-size:9px;color:#5F7085}.watermark{position:fixed;top:45%;left:5%;width:90%;text-align:center;transform:rotate(-25deg);font-size:60px;font-weight:bold;color:rgba(17,42,71,.08);z-index:-1}
  .cad-frame{border:1px solid #9FAFC2;break-inside:avoid}.cad-title{display:flex;justify-content:space-between;gap:12px;padding:12px 14px;border-bottom:1px solid #CBD6E3}.cad-title strong{font-size:14px;overflow-wrap:anywhere}.cad-title span{font-size:9px;white-space:nowrap;color:#49647D}.cad-canvas{width:100%;height:515px}.cad-canvas svg{display:block;width:100%;height:100%}.cad-stamp{display:grid;grid-template-columns:2fr 1fr;border-top:1px solid #CBD6E3}.cad-stamp>div{padding:4px 12px}.cad-stamp>div+div{border-left:1px solid #CBD6E3}.cad-stamp .field{padding:4px 0;font-size:10px}.cad-legend{font-size:9px;color:#5F7085}.cad-legend span{margin-right:10px;color:#1764C0}.cad-legend span:nth-child(2){color:#16725B}.cad-legend span:nth-child(3){color:#AF302B}h3{font-size:12px;padding:8px 10px;background:#EDF4FE;margin:0;break-after:avoid}.photo-group{margin-bottom:12px;break-inside:avoid}.photo-summary th,.photo-summary td{padding:4px 7px;border:1px solid #333;font-size:10px;line-height:1.25}.photo-summary th{background:white;width:25%;font-weight:normal;color:#111}.photo-summary td{color:#285580}.photo-identification{padding:4px 7px;border:1px solid #333;border-top:0}.photo-data{display:grid;grid-template-columns:1fr 1fr 1fr;border:1px solid #D6DFEB;margin-bottom:10px;break-after:avoid}.photo-data .field{padding:8px;font-size:10px}.photo-data .field+.field{border-left:1px solid #D6DFEB}
  </style></head><body>${final ? '' : '<div class="watermark">PRÉVIA · SEM VALIDADE FINAL</div>'}${body}</body></html>`;
}

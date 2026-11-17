import { thicknessCalculationFields, reportSectionVisible } from '@weldcosta/shared';
import { escape, sheet, type PdfReport } from '../reference-layout';

export function calculation(report: PdfReport) {
  if (!reportSectionVisible(report, 'calculation')) return '';
  const data = report.specificData as Record<string, unknown>;
  return sheet(
    report,
    'CÁLCULO',
    `<section class="measurement-calculation">
      <h2>MEMORIAL TUBULAÇÃO</h2>
      <div class="measurement-formula">
        <h3>FÓRMULA ESPESSURA MÍNIMA REQUERIDA — ASME B31.1</h3>
        <div class="measurement-equation" aria-label="t = (P vezes D) dividido por (2 vezes S vezes E vezes W mais P vezes Y) mais C">
          <span>t =</span><span class="measurement-fraction"><span>P · D</span><span>2 · (S · E · W) + (P · Y)</span></span><span>+ C</span>
        </div>
      </div>
      <table><thead><tr><th>Memorial de Cálculo — TUBO</th></tr></thead></table>
    </section>${thicknessCalculationFields.map((item) => `<table class="measurement-calculation-row"><colgroup><col style="width:60%"><col style="width:12%"><col style="width:28%"></colgroup><tbody><tr><th scope="row">${escape(item.label)}</th><td>${item.symbol}</td><td${['calculationMinimumThickness', 'calculationMeasuredThickness'].includes(item.path) ? ' class="measurement-calculation-result"' : ''}>${escape(String(data[item.path] ?? '').trim() || '—')}</td></tr></tbody></table>`).join('')}`,
    true,
    'measurement-calculation-sheet',
  );
}

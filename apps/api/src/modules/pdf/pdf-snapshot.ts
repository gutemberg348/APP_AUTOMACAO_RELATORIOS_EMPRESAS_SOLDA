import type { PdfReport } from './templates/reports/layout';

/** Internal drawing notes never cross the PDF boundary, for any renderer or status. */
export function reportForPdf(report: PdfReport): PdfReport {
  return {
    ...report,
    // Older LP reports can still contain dimensions entered by previous app versions.
    // Exclude this field only from the printable copy, never from the saved report.
    points:
      report.reportType.code === 'LP'
        ? report.points.map((point) => {
            const data = point.data;
            if (!data || typeof data !== 'object' || Array.isArray(data)) return point;
            const printable = { ...data };
            delete printable.dimension;
            return { ...point, data: printable };
          })
        : report.points,
    drawings: report.drawings.map((drawing) => {
      const data = drawing.data;
      if (!data || typeof data !== 'object' || Array.isArray(data)) return drawing;
      const printable = { ...data };
      delete printable.notes;
      delete printable.notesDrawing;
      return { ...drawing, data: printable };
    }),
  };
}

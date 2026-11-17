import {
  isHydrostaticTestPhoto,
  customReportPages,
  isCustomPagePhoto,
  reportSectionVisible,
  visibleReportData,
} from '@weldcosta/shared';
import type { PdfReport } from './templates/reports/layout';

/** Internal drawing notes never cross the PDF boundary, for any renderer or status. */
export function reportForPdf(report: PdfReport): PdfReport {
  const customImages = new Set(
    customReportPages(report.specificData).flatMap((p) =>
      p.drawings.flatMap((d) =>
        d.data.elements.flatMap((e) => (e.type === 'image' ? [e.mediaKey] : [])),
      ),
    ),
  );
  const media = report.media.filter((m) => {
    if (isCustomPagePhoto(m) || customImages.has(m.clientUploadId ?? m.id)) return true;
    if (!reportSectionVisible(report, 'drawings') && m.sectionKey === 'drawing') return false;
    if (!reportSectionVisible(report, 'points') && m.reportPointId) return false;
    if (
      !reportSectionVisible(report, 'testPhotos') &&
      (m.sectionKey === 'test-photos' ||
        (['TH', 'ME'].includes(report.reportType.code) && isHydrostaticTestPhoto(m)))
    )
      return false;
    return true;
  });
  return {
    ...report,
    specificData: visibleReportData(report) as PdfReport['specificData'],
    media: ['TH', 'ME'].includes(report.reportType.code)
      ? media.filter((m) => isHydrostaticTestPhoto(m) || customImages.has(m.clientUploadId ?? m.id))
      : media,
    signatures: reportSectionVisible(report, 'signatures') ? report.signatures : [],
    // Older LP reports can still contain dimensions entered by previous app versions.
    // Exclude this field only from the printable copy, never from the saved report.
    points:
      report.reportType.code === 'TH'
        ? []
        : report.reportType.code === 'LP'
          ? report.points.map((point) => {
              const data = point.data;
              if (!data || typeof data !== 'object' || Array.isArray(data)) return point;
              const printable = { ...data };
              delete printable.dimension;
              return { ...point, data: printable };
            })
          : report.points,
    drawings:
      ['TH', 'ME'].includes(report.reportType.code) || !reportSectionVisible(report, 'drawings')
        ? []
        : report.drawings.map((drawing) => {
            const data = drawing.data;
            if (!data || typeof data !== 'object' || Array.isArray(data)) return drawing;
            const printable = { ...data };
            delete printable.notes;
            delete printable.notesDrawing;
            return { ...drawing, data: printable };
          }),
  };
}

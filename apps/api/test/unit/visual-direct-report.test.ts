import { describe, expect, it } from 'vitest';
import {
  buildReportDefaults,
  validateSpecificData,
  reportReviewWarnings,
  reportSections,
  newDrawingData,
} from '@weldcosta/shared';
import { render } from '../../src/modules/pdf/templates/reports/evs';
import type { PdfReport } from '../../src/modules/pdf/templates/reports/layout';
import { reportCorrections } from '../../../app/features/reports/report-save-feedback';
import { cleanReportDraft } from '../../../app/features/reports/report-draft-clean';

describe('Visual direct report', () => {
  const specificData = {
    drawingReference: 'DE-QA REV-0',
    fillerMetal: 'ER-QA',
    weldingSpecification: 'EPS-QA',
    inspectionType: 'EVS DIRETO',
    inspectionRecords: [
      {
        item: '01',
        drawingReference: 'DE-QA REV-0',
        diameter: '4',
        joint: '01/20',
        rootStamp: '02',
        finishStamp: '03',
        result: 'APPROVED',
      },
    ],
  };
  it('supports independent defaults and optional incomplete records without changing EVS', () => {
    expect(validateSpecificData('EVD', {}, 'draft')).toEqual({});
    expect(
      validateSpecificData(
        'EVD',
        cleanReportDraft({ inspectionRecords: [{ item: '', result: '' }] }),
        'draft',
      ),
    ).toEqual({ inspectionRecords: [{}] });
    expect(validateSpecificData('EVD', specificData, 'submission')).toEqual(specificData);
    expect(() => validateSpecificData('EVS', specificData, 'draft')).toThrow();
    const project = {
      name: 'Work',
      reportDefaults: {
        byType: {
          EVS: { inspectionType: 'EVS REMOTO', procedureRevision: 'REMOTE-ONLY' },
          EVD: { weldingSpecification: 'EPS-DIRECT' },
        },
      },
    };
    expect(buildReportDefaults('EVD', project, { name: 'Client' })).toMatchObject({
      inspectionType: 'EVS DIRETO',
      weldingSpecification: 'EPS-DIRECT',
    });
    expect(
      buildReportDefaults('EVD', project, { name: 'Client' }).procedureRevision,
    ).toBeUndefined();
    expect(buildReportDefaults('EVS', project, { name: 'Client' }).inspectionType).toBe(
      'EVS REMOTO',
    );
  });
  it('locates invalid table fields and keeps the same photo warnings as EVS', () => {
    try {
      validateSpecificData('EVD', { inspectionRecords: [{ result: 'INVALID' }] }, 'draft');
      throw new Error('Expected validation error');
    } catch (error) {
      expect(error).toHaveProperty('issues');
      const corrections = reportCorrections(
        (error as { issues: never[] }).issues,
        reportSections.EVD!,
        [],
        true,
      );
      expect(corrections[0]).toMatchObject({
        label: 'Registro 1 · Laudo do registro',
        path: ['specificData', 'inspectionRecords', '0', 'result'],
      });
    }
    expect(
      reportReviewWarnings({
        title: 'Direct',
        reportDate: '2026-10-30',
        reportType: { code: 'EVD', config: {} },
        specificData,
        points: [{ id: 'p', number: '01', type: 'WELD', data: { acceptable: true } }],
        media: [],
      }),
    ).toContain('Pontos sem fotos: 01.');
  });
  it('prints direct fields, all table records, drawings and photos while preserving the EVS title', () => {
    const longDrawing = 'LONG-DRAWING-'.repeat(80);
    const report = {
      number: '001',
      title: 'TANK QA',
      reportDate: '2026-10-30',
      reportType: { code: 'EVD', name: 'Ensaio Visual Direto' },
      project: { name: 'Work' },
      specificData: {
        ...specificData,
        inspectionRecords: Array.from({ length: 21 }, (_, i) => ({
          ...specificData.inspectionRecords[0],
          item: String(i + 1),
          drawingReference: i === 20 ? longDrawing : 'DRAW-' + i,
        })),
      },
      points: [{ id: 'p', number: '01', data: { acceptable: true } }],
      drawings: [{ data: newDrawingData() }],
      signatures: [],
      media: [{ id: 'photo', reportPointId: 'p', sectionKey: 'photos' }],
    } as unknown as PdfReport;
    const html = render(report, new Map([['photo', 'data:image/png;base64,AA==']]));
    expect(html).toContain('RELATÓRIO DE ENSAIO<br>VISUAL DIRETO');
    expect(html).toContain('EVS DIRETO');
    expect(html).toContain('EPS-QA');
    expect(html).toContain('ER-QA');
    expect(html).toContain('REGISTROS DE INSPEÇÃO · CONTINUAÇÃO');
    expect(html).toContain('REGISTRO 21 · DESENHOS Nº / REVISÃO');
    expect(html.match(/LONG-DRAWING-/g)?.length).toBeGreaterThan(70);
    expect(html).toContain('evs-drawing');
    expect(html).toContain('report-photo-frame');
    const original = render(
      {
        ...report,
        reportType: { ...report.reportType, code: 'EVS' },
        specificData: {},
      } as PdfReport,
      new Map(),
    );
    expect(original).toContain('RELATÓRIO DE ENSAIO<br>VISUAL DE SOLDAS');
    expect(original).not.toContain('REGISTROS DE INSPEÇÃO');
  });
});

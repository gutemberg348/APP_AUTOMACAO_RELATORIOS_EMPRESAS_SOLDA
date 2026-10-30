import { describe, expect, it } from 'vitest';
import { newDrawingData, drawingDataSchema } from '@weldcosta/shared';
import { render as evs } from '../../src/modules/pdf/templates/reports/evs';
import { render as lp } from '../../src/modules/pdf/templates/reports/lp';
import { render as th } from '../../src/modules/pdf/templates/reports/hydrostatic';
import { render as me } from '../../src/modules/pdf/templates/reports/thickness';
import { render as rdo } from '../../src/modules/pdf/templates/reports/rdo';
import type { PdfReport } from '../../src/modules/pdf/templates/reports/layout';
import { reportForPdf } from '../../src/modules/pdf/pdf-snapshot';

describe('Internal drawing observations', () => {
  it.each(Object.entries({ EVS: evs, EVD: evs, LP: lp, TH: th, ME: me, RDO: rdo }))(
    'omits typed and handwritten notes in %s without losing the main drawing or formal conclusion',
    (code, render) => {
      const data = {
        ...newDrawingData(),
        title: 'MAIN-DRAWING',
        notes: 'INTERNAL-TYPED-NOTE',
        notesDrawing: {
          elements: [
            {
              id: 'private-text',
              type: 'text',
              text: 'INTERNAL-HANDWRITTEN-TEXT',
              x: 100,
              y: 100,
              color: '#F00ABC',
            },
            {
              id: 'private-line',
              type: 'line',
              x1: 1,
              y1: 1,
              x2: 20,
              y2: 20,
              strokeColor: '#F00ABC',
            },
          ],
        },
        elements: [{ id: 'public', type: 'text', text: 'PUBLIC-DRAWING-TEXT', x: 200, y: 200 }],
      };
      const report = {
        number: '001',
        title: 'QA',
        reportDate: '2026-10-30',
        reportType: { code, name: code },
        project: { name: 'QA' },
        company: { name: 'QA' },
        specificData: { finalReport: 'FORMAL-CONCLUSION', observation: 'FORMAL-OBSERVATION' },
        points: [],
        media: [],
        signatures: [],
        drawings: [{ data }],
      } as unknown as PdfReport;
      const before = structuredClone(report);
      const printable = reportForPdf(report);
      expect(printable.drawings[0]!.data).not.toHaveProperty('notes');
      expect(printable.drawings[0]!.data).not.toHaveProperty('notesDrawing');
      const html = render(printable, new Map());
      for (const secret of [
        'INTERNAL-TYPED-NOTE',
        'INTERNAL-HANDWRITTEN-TEXT',
        '#F00ABC',
        'drawing-notes',
      ])
        expect(html).not.toContain(secret);
      expect(html).toContain('PUBLIC-DRAWING-TEXT');
      expect(html).toContain(
        code === 'TH' || code === 'RDO' ? 'FORMAL-OBSERVATION' : 'FORMAL-CONCLUSION',
      );
      expect(report).toEqual(before);
      expect(drawingDataSchema.parse(data).notes).toBe('INTERNAL-TYPED-NOTE');
      expect(drawingDataSchema.parse(data).notesDrawing?.elements).toHaveLength(2);
    },
  );
});

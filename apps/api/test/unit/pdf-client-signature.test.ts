import { describe, expect, it } from 'vitest';
import { render as evs } from '../../src/modules/pdf/templates/reports/evs';
import { render as lp } from '../../src/modules/pdf/templates/reports/lp';
import { render as th } from '../../src/modules/pdf/templates/reports/hydrostatic';
import { render as me } from '../../src/modules/pdf/templates/reports/thickness';
import { render as rdo } from '../../src/modules/pdf/templates/reports/rdo';
import type { PdfReport } from '../../src/modules/pdf/templates/reports/layout';

describe('Printed client signature', () => {
  it.each(Object.entries({ EVS: evs, EVD: evs, LP: lp, TH: th, ME: me, RDO: rdo }))(
    '%s leaves the line blank and identifies the linked company, including existing reports',
    (code, render) => {
      for (const withSignatures of [false, true]) {
        const report = {
          number: '001',
          title: 'QA',
          reportDate: '2026-10-31',
          reportType: { code, name: code },
          company: { name: 'Empresa Açúcar & Solda <Sul>' },
          project: { name: 'Obra' },
          specificData: { client: 'OUTRO NOME NO CAMPO TÉCNICO', finalReport: 'APROVADO' },
          points: [],
          media: [],
          drawings: [],
          signatures: withSignatures
            ? [
                {
                  id: 'inspector',
                  role: 'INSPECTOR',
                  name: 'INSPETOR MANTIDO',
                  registrationNumber: 'CREA-123',
                },
                {
                  id: 'client',
                  role: 'CLIENT',
                  name: 'REPRESENTANTE ANTIGO',
                  registrationNumber: 'REGISTRO ANTIGO',
                  signedAt: '2026-10-01',
                },
                { id: 'client-two', role: 'CLIENT', name: 'SEGUNDO CLIENTE' },
              ]
            : [],
          signatureImages: {
            inspector: 'data:image/png;base64,aW5zcGVjdG9y',
            client: 'data:image/png;base64,Y2xpZW50',
          },
        } as unknown as PdfReport;
        const before = structuredClone(report);
        const html = render(report, new Map());
        expect(html.match(/class="evs-signer evs-client-signer"/g)).toHaveLength(1);
        expect(html).toContain(
          '<div class="evs-signature-space"></div><div class="evs-signature-name">EMPRESA AÇÚCAR &amp; SOLDA &lt;SUL&gt;</div><p>DATA: </p>',
        );
        expect(html).not.toContain('Y2xpZW50');
        expect(html).not.toContain('REPRESENTANTE ANTIGO');
        expect(html).not.toContain('REGISTRO ANTIGO');
        expect(html).not.toContain('SEGUNDO CLIENTE');
        if (withSignatures) {
          expect(html).toContain('INSPETOR MANTIDO');
          expect(html).toContain('CREA-123');
          expect(html).toContain('aW5zcGVjdG9y');
        }
        expect(report).toEqual(before);
      }
    },
  );
});

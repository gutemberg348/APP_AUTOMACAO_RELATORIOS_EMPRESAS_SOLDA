import { expect, it } from 'vitest';
import { reportPdfName } from '@weldcosta/shared';

it('names all report types using the entered number, type and line', () => {
  for (const code of ['EVS', 'EVD', 'LP', 'TH', 'ME', 'RDO']) {
    expect(
      reportPdfName({ number: '001', title: 'Serpentina TQ cozinhador', reportType: { code } }),
    ).toBe(`REL 001 - ${code === 'ME' ? 'M.E' : code} - SERPENTINA TQ COZINHADOR.pdf`);
  }
});
it('uses LP line, supports old titles and removes unsafe filename characters', () => {
  expect(
    reportPdfName({
      number: '002',
      title: 'Título antigo',
      reportType: { code: 'LP' },
      specificData: { inspectionArea: 'Linha de vapor' },
    }),
  ).toBe('REL 002 - LP - LINHA DE VAPOR.pdf');
  expect(
    reportPdfName({
      number: '01/26',
      title: 'Obra · Visual',
      reportType: { code: 'EVS', name: 'Visual' },
    }),
  ).toBe('REL 01 26 - EVS - OBRA.pdf');
});

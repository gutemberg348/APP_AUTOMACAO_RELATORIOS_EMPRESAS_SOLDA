import { expect, it } from 'vitest';
import {
  customReportPageSchema,
  customReportPages,
  customPhotoPrefix,
  isCustomPagePhoto,
  newDrawingData,
  reportTypeCodes,
  validateSpecificData,
  type CurrentUser,
} from '@weldcosta/shared';
import { cleanReportDraft } from '../../../app/features/reports/report-draft-clean';
import { assertCustomDrawingAccess } from '../../src/modules/reports/reports.custom-pages';
import { reportCorrections } from '../../../app/features/reports/report-save-feedback';

it.each(reportTypeCodes)('saves, reopens and validates custom pages in %s', (code) => {
  const page = customReportPageSchema.parse({
    id: 'page-1',
    kind: 'photos',
    title: '',
    photosPerPage: 3,
  });
  const data = cleanReportDraft({ customPages: [page] }, ['specificData']);
  const parsed = validateSpecificData(code, data, 'draft');
  expect(customReportPages(parsed)[0]).toEqual(page);
  expect(validateSpecificData(code, parsed, 'submission')).toEqual(parsed);
  expect(validateSpecificData(code, {}, 'draft')).toEqual({});
  expect(() =>
    validateSpecificData(code, { customPages: [{ ...page, photosPerPage: 5 }] }, 'draft'),
  ).toThrow();
  expect(() => validateSpecificData(code, { customPages: [page, page] }, 'draft')).toThrow();
});
it('isolates each page and point attachment before and after upload', () => {
  const id = customPhotoPrefix('page-1', 'point-2') + 'unique';
  expect(isCustomPagePhoto({ id })).toBe(true);
  expect(isCustomPagePhoto({ id: 'server-id', clientUploadId: id })).toBe(true);
  expect(isCustomPagePhoto({ id: 'standard-photo' })).toBe(false);
  expect(id.startsWith(customPhotoPrefix('page-1', 'point-1'))).toBe(false);
  expect(id.startsWith(customPhotoPrefix('page-2', 'point-2'))).toBe(false);
});
it('requires drawing permission for edits to custom drawings and preserves existing pages for other changes', () => {
  const data = {
    customPages: [
      customReportPageSchema.parse({
        id: 'drawing',
        kind: 'drawing',
        drawings: [{ data: newDrawingData() }],
      }),
    ],
  };
  const user = { permissions: [] } as unknown as CurrentUser;
  expect(() => assertCustomDrawingAccess(user, data)).toThrow('permissão');
  expect(() => assertCustomDrawingAccess(user, data, structuredClone(data))).not.toThrow();
  expect(() =>
    assertCustomDrawingAccess({ ...user, permissions: ['drawing.edit'] }, data),
  ).not.toThrow();
});
it('explains how to correct errors in a custom page', () => {
  const issue = reportCorrections(
    [
      {
        path: ['specificData', 'customPages', 0, 'photosPerPage'],
        message: 'Quantidade inválida.',
      },
    ],
    [],
    [],
  )[0]!;
  expect(issue.label).toContain('Quantidade de fotos');
  expect(issue.guidance).toContain('Adicionar página personalizada');
});

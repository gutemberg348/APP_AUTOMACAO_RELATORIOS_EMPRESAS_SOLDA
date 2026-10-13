import { describe, expect, it } from 'vitest';
import { formatInputMask, maskedEdit, type InputMask } from '../../../app/utils/input-masks';

describe('Masked input editing with delayed native selection', () => {
  const examples: [InputMask, string, string][] = [
    ['cnpj', '12345678000190', '12.345.678/0001-90'],
    ['cnpj', 'AB123456CD0190', 'AB.123.456/CD01-90'],
    ['cpf', '12345678901', '123.456.789-01'],
    ['phone', '11987654321', '(11) 98765-4321'],
    ['phone', '1134567890', '(11) 3456-7890'],
    ['date', '11102026', '11/10/2026'],
  ];
  it.each(examples)('keeps every keystroke in order for %s %s', (mask, digits, expected) => {
    let value = '';
    for (const char of digits) {
      // Deliberately wrong cursor: the native selection notification can be
      // from before the previous change or after the current one.
      const input = value + char;
      const edit = maskedEdit(mask, value, input, { start: 0, end: 0 }, char);
      value = edit.text;
      expect(edit.selection.start).toBe(value.length);
    }
    expect(value).toBe(expected);
    while (value) {
      const edit = maskedEdit(mask, value, value.slice(0, -1), { start: 0, end: 0 }, 'Backspace');
      expect(edit.text.length).toBeLessThan(value.length);
      value = edit.text;
    }
  });
  it('inserts repeated digits at the requested position and replaces a selection', () => {
    expect(maskedEdit('date', '11/10/202', '11/10/2202', { start: 7, end: 7 }, '2')).toEqual({
      text: '11/10/2202',
      selection: { start: 8, end: 8 },
    });
    expect(maskedEdit('date', '11/10/2026', '21/10/2026', { start: 0, end: 1 }, '2')).toEqual({
      text: '21/10/2026',
      selection: { start: 1, end: 1 },
    });
  });
  it('backs over punctuation without trapping the caret', () => {
    expect(maskedEdit('cnpj', '12.345', '12345', { start: 3, end: 3 }, 'Backspace')).toEqual({
      text: '13.45',
      selection: { start: 1, end: 1 },
    });
    expect(maskedEdit('date', '11/10/2026', '1110/2026', { start: 2, end: 2 }, 'Delete')).toEqual({
      text: '11/02/026',
      selection: { start: 2, end: 2 },
    });
  });
  it('handles paste, select-all, country codes, length limits and external values', () => {
    expect(formatInputMask('phone', '(55) 98765-43219')).toBe('(55) 98765-4321');
    expect(formatInputMask('phone', '5511987654321')).toBe('+55 (11) 98765-4321');
    expect(maskedEdit('phone', '', '+55 (11) 98765-4321', { start: 0, end: 0 }).text).toBe(
      '+55 (11) 98765-4321',
    );
    expect(
      maskedEdit('cnpj', '12.345.678/0001-90', '98765432000110', { start: 0, end: 18 }).text,
    ).toBe('98.765.432/0001-10');
    expect(
      maskedEdit('cpf', '123.456.789-01', '123.456.789-019', { start: 14, end: 14 }, '9'),
    ).toEqual({ text: '123.456.789-01', selection: { start: 14, end: 14 } });
    expect(formatInputMask('date', '11/10/2026')).toBe('11/10/2026');
    expect(formatInputMask('cnpj', 'ab123456cd0190')).toBe('AB.123.456/CD01-90');
  });
});

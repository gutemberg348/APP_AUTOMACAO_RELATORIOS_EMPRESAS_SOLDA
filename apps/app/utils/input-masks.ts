export type InputMask = 'cnpj' | 'cpf' | 'phone' | 'date';

function applyPattern(value: string, pattern: string) {
  let result = '';
  let index = 0;
  for (const character of pattern) {
    if (index >= value.length) break;
    result += character === '#' ? value[index++] : character;
  }
  return result;
}

export function formatInputMask(mask: InputMask, value: string) {
  if (mask === 'cnpj') {
    const characters = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    // The first 12 positions also accept letters; check digits remain numeric.
    const document = characters.slice(0, 12) + characters.slice(12).replace(/\D/g, '').slice(0, 2);
    return applyPattern(document, '##.###.###/####-##');
  }

  const digits = value.replace(/\D/g, '');
  if (mask === 'date') return applyPattern(digits.slice(0, 8), '##/##/####');
  if (mask === 'cpf') return applyPattern(digits.slice(0, 11), '###.###.###-##');

  const explicitCountryCode = value.trimStart().startsWith('+');
  const brazilCountryCode =
    (explicitCountryCode && digits.startsWith('55')) ||
    (!value.trimStart().startsWith('(') && digits.length > 11 && digits.startsWith('55'));
  if (explicitCountryCode && !brazilCountryCode) return '+' + digits.slice(0, 15);

  const local = (brazilCountryCode ? digits.slice(2) : digits).slice(0, 11);
  const pattern = local.length > 10 ? '(##) #####-####' : '(##) ####-####';
  const formatted = applyPattern(local, pattern);
  return brazilCountryCode ? '+55' + (formatted ? ' ' + formatted : '') : formatted;
}

/** Map a caret by content, so inserted punctuation does not move it to the end. */
export function maskedCaret(mask: InputMask, input: string, caret: number, formatted: string) {
  const significant = mask === 'cnpj' ? /[A-Z0-9]/ : /[0-9]/;
  const prefix = input.slice(0, caret).toUpperCase();
  let remaining = [...prefix].filter((character) => significant.test(character)).length;
  let position = input.startsWith('+') && caret > 0 ? 1 : 0;
  while (position < formatted.length && remaining > 0) {
    if (significant.test(formatted[position]!)) remaining--;
    position++;
  }
  return position;
}

export type MaskSelection = { start: number; end: number };

/** Infer the edit from text when native selection events arrive late. */
export function maskedEdit(
  mask: InputMask,
  previous: string,
  input: string,
  selection: MaskSelection,
  key = '',
  actualCaret?: number | null,
) {
  let start = 0;
  while (start < previous.length && start < input.length && previous[start] === input[start])
    start++;
  let oldEnd = previous.length,
    newEnd = input.length;
  while (oldEnd > start && newEnd > start && previous[oldEnd - 1] === input[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }
  const delta = input.length - previous.length;
  // A selection is usable only if it reproduces the actual edit. On iOS it
  // can already describe the position after the keystroke instead of before.
  const [from, to]: [number, number] =
    selection.start !== selection.end
      ? [selection.start, selection.end]
      : delta < 0
        ? key === 'Delete'
          ? [selection.start, selection.start - delta]
          : [selection.start + delta, selection.start]
        : [selection.start, selection.end];
  const length = delta + to - from;
  if (
    !(delta > 0 && input.startsWith(previous)) &&
    from >= 0 &&
    to <= previous.length &&
    length >= 0 &&
    previous.slice(0, from) + input.slice(from, from + length) + previous.slice(to) === input
  ) {
    start = from;
    oldEnd = to;
    newEnd = from + length;
  }
  let raw = input;
  let caret = actualCaret ?? newEnd;
  const significant = mask === 'cnpj' ? /[A-Z0-9]/i : /\d/;
  // Delete the neighboring content when backspace/delete crosses punctuation,
  // instead of restoring the separator and trapping the caret.
  if (
    delta < 0 &&
    oldEnd > start &&
    newEnd === start &&
    ![...previous.slice(start, oldEnd)].some((c) => significant.test(c))
  ) {
    let index = key === 'Delete' ? start : start - 1;
    const direction = key === 'Delete' ? 1 : -1;
    while (index >= 0 && index < raw.length && !significant.test(raw[index]!)) index += direction;
    if (index >= 0 && index < raw.length) {
      raw = raw.slice(0, index) + raw.slice(index + 1);
      if (index < caret) caret--;
    }
  }
  const text = formatInputMask(mask, raw);
  const position = maskedCaret(mask, raw, Math.max(0, Math.min(caret, raw.length)), text);
  return { text, selection: { start: position, end: position } };
}

export const maskPlaceholders: Record<InputMask, string> = {
  cnpj: '00.000.000/0000-00',
  cpf: '000.000.000-00',
  phone: '(00) 00000-0000',
  date: 'DD/MM/AAAA',
};

export const lpPenetrantOptions = [
  { value: 'COLORIDO_TIPO_II', label: 'Colorido · Tipo II' },
  { value: 'FLUORESCENTE_TIPO_I', label: 'Fluorescente · Tipo I' },
] as const;
export const lpRemovalOptions = [
  { value: 'AGUA', label: 'Água' },
  { value: 'SOLVENTE', label: 'Solvente' },
] as const;
// Recognize existing free-text values while preserving unrecognized descriptions.
export function lpChoiceValue(kind: 'penetrant' | 'removal', value: unknown) {
  const text = String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[_·()/-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (kind === 'penetrant') {
    if (/^(?:COLORIDO(?: TIPO ?II)?|TIPO ?II)$/.test(text)) return 'COLORIDO_TIPO_II';
    if (/^(?:FLUORESCENTE(?: TIPO ?I)?|TIPO ?I)$/.test(text)) return 'FLUORESCENTE_TIPO_I';
  } else {
    if (/^(?:A )?AGUA$/.test(text)) return 'AGUA';
    if (/^(?:A )?SOLVENTE$/.test(text)) return 'SOLVENTE';
  }
  return '';
}

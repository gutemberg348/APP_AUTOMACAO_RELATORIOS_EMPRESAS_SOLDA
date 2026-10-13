export function formatDate(value: string | null | undefined) {
  if (!value) return 'Não informada';
  const [year, month, day] = value.slice(0, 10).split('-');
  return day && month && year ? day + '/' + month + '/' + year : value;
}
export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

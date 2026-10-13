export const monthNames = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export function dateISO(year: number, month: number, day: number) {
  return `${String(year).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function isISODate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  if (year < 1 || year > 9999) return false;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function dateDisplay(value: string) {
  return isISODate(value)
    ? value.slice(8, 10) + '/' + value.slice(5, 7) + '/' + value.slice(0, 4)
    : value;
}

export function dateInputValue(value: string) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value;
  const iso = value.slice(6) + '-' + value.slice(3, 5) + '-' + value.slice(0, 2);
  return isISODate(iso) ? iso : value;
}

export function todayISO() {
  const date = new Date();
  return dateISO(date.getFullYear(), date.getMonth(), date.getDate());
}

export function calendarDays(year: number, month: number) {
  const first = new Date(0);
  first.setUTCFullYear(year, month, 1);
  const offset = (first.getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(0);
    date.setUTCFullYear(year, month, index - offset + 1);
    return {
      iso: dateISO(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
      day: date.getUTCDate(),
      month: date.getUTCMonth(),
      year: date.getUTCFullYear(),
    };
  });
}

/** LP weld numbers are a list, not a numeric range (01-04 means 01 and 04). */
export function lpWeldNumbers(number: string): string[] {
  const text = number.trim();
  const parts = /^\d+(?:\s*[-,;/\s]\s*\d+)*$/.test(text) ? text.split(/[-,;/\s]+/) : [text];
  const seen = new Set<string>();
  return parts.filter((part) => {
    const key = lpWeldKey(part);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function lpWeldKey(number: string) {
  return /^\d+$/.test(number) ? number.replace(/^0+(?=\d)/, '') : number.toLocaleUpperCase();
}

/**
 * First sheet wins. Keep source records/IDs intact for drawing marks, offline
 * uploads and legacy data. Fully covered sheets contribute their photos to the
 * first owning group; partially covered sheets keep only their unused numbers.
 */
export function lpWeldGroups(points: readonly { number: string; data?: unknown }[]) {
  const owners = new Map<string, number>();
  const groups: { index: number; number: string; memberIndexes: number[] }[] = [];
  points.forEach((point, index) => {
    const numbers = lpWeldNumbers(lpWeldLabel(point));
    const unused = numbers.filter((number) => !owners.has(lpWeldKey(number)));
    if (unused.length || !numbers.length) {
      const groupIndex = groups.length;
      groups.push({ index, number: unused.join(' - '), memberIndexes: [index] });
      unused.forEach((number) => owners.set(lpWeldKey(number), groupIndex));
    } else {
      groups[owners.get(lpWeldKey(numbers[0]!))!]!.memberIndexes.push(index);
    }
  });
  return groups;
}

/** Separate displayed weld coverage from stable point numbers used by drawings. */
export function lpWeldLabel(point: { number: string; data?: unknown }): string {
  const data = point.data;
  return data &&
    typeof data === 'object' &&
    'weldNumbers' in data &&
    typeof data.weldNumbers === 'string'
    ? data.weldNumbers
    : point.number;
}

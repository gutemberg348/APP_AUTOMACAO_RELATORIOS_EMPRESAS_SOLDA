import { drawingId, nextPointNumber, reportSections, type ReportPoint } from '@weldcosta/shared';

export function nextLpWeldNumber(points: { number: string }[]) {
  return nextPointNumber(
    points.flatMap((point) =>
      /^\d+(?:\s*[-,;]\s*\d+)+$/.test(point.number.trim())
        ? point.number.match(/\d+/g)!.map((number) => ({ number }))
        : [point],
    ),
  );
}

export function pointBatch(
  points: ReportPoint[],
  measurement: boolean,
  count: number,
  repeat: boolean,
  firstNumber?: string,
  projectThickness = '',
) {
  if (!Number.isInteger(count) || count < 1 || count > 50)
    throw new Error('Informe de 1 a 50 pontos.');
  const created: ReportPoint[] = [];
  for (let i = 0; i < count; i++) {
    const previous = repeat ? [...points, ...created].at(-1) : undefined;
    const number =
      i === 0 && firstNumber ? firstNumber.trim() : nextPointNumber([...points, ...created]);
    if (
      !number ||
      number.length > 100 ||
      [...points, ...created].some(
        (p) => p.number.trim().toLocaleUpperCase() === number.toLocaleUpperCase(),
      )
    )
      throw new Error('Informe um número inicial único, com até 100 caracteres.');
    created.push({
      clientId: drawingId(),
      number,
      type: measurement ? 'MEASUREMENT' : 'WELD',
      label: previous?.label ?? '',
      value: null,
      unit: previous?.unit ?? (measurement ? 'mm' : ''),
      data: {
        discontinuity: '-',
        ...(previous?.data?.dimension ? { dimension: previous.data.dimension } : {}),
        ...(measurement && (previous?.data?.projectThickness || projectThickness)
          ? { projectThickness: previous?.data?.projectThickness || projectThickness }
          : {}),
      },
    });
  }
  return created;
}

const get = (data: unknown, path: string) =>
  path
    .split('.')
    .reduce<unknown>(
      (v, key) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[key] : undefined),
      data,
    );
const empty = (value: unknown) => value === undefined || value === null || value === '';
export function reusableReportFields(code: string, source: unknown, current: unknown) {
  return (reportSections[code] ?? [])
    .flatMap((s) => s.fields)
    .flatMap((field) => {
      // Report-specific observations, outcomes, author and date belong to the new inspection.
      if (
        field.kind === 'long' ||
        field.kind === 'result' ||
        ['date', 'inspector', 'visa'].includes(field.path)
      )
        return [];
      const value = get(source, field.path);
      return typeof value === 'string' && value.trim() && empty(get(current, field.path))
        ? [{ path: field.path, value }]
        : [];
    });
}

// Sources are newest first. An incomplete draft must not hide previously saved setup.
export function recentReportDefaults(code: string, sources: unknown[]) {
  const result: Record<string, unknown> = {};
  for (const source of sources) {
    for (const field of reusableReportFields(code, source, result)) {
      const keys = field.path.split('.');
      let target = result;
      for (const key of keys.slice(0, -1)) {
        target[key] ??= {};
        target = target[key] as Record<string, unknown>;
      }
      target[keys.at(-1)!] = field.value;
    }
  }
  return result;
}

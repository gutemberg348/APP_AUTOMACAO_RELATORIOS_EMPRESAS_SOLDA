// Remove empty optional fields, but keep draft placeholders accepted by the schema.
// Otherwise a blank signer name / discontinuity code becomes a missing required key.
export function cleanReportDraft(value: unknown, path: string[] = []): unknown {
  if (value === '') {
    if (
      (path[0] === 'signatures' && path.length === 3 && path[2] === 'name') ||
      (path[0] === 'points' && path.length === 3 && path[2] === 'number') ||
      (path[0] === 'specificData' &&
        path[1] === 'discontinuities' &&
        path.length === 4 &&
        path[3] === 'code')
    )
      return '';
    return undefined;
  }
  if (Array.isArray(value))
    return value.map((child, i) => cleanReportDraft(child, [...path, String(i)]));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, child]) => [key, cleanReportDraft(child, [...path, key])])
        .filter(([, child]) => child !== undefined),
    );
  return value;
}

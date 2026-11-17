import type { PhotoAnnotations } from './photo-annotations';

/** Legacy point fields remain usable when opening a photo in the new editor. */
export function measurementPhotoDefaults(
  point?: { number?: string; label?: string | null; data?: unknown },
  projectThickness?: unknown,
): NonNullable<PhotoAnnotations['measurementDetails']> {
  const data =
    point?.data && typeof point.data === 'object' && !Array.isArray(point.data)
      ? (point.data as Record<string, unknown>)
      : {};
  return {
    side: point?.label ?? '',
    pointNumbers: point?.number ?? '',
    discontinuity: String(data.discontinuity ?? ''),
    acceptable: typeof data.acceptable === 'boolean' ? data.acceptable : null,
    projectThickness: String(data.projectThickness ?? projectThickness ?? ''),
  };
}

/** Keep numbering across saved photos and local edits, without renumbering existing marks. */
export function nextPhotoMeasurementNumber(photos: (PhotoAnnotations | null | undefined)[]) {
  return (
    1 + Math.max(0, ...photos.flatMap((p) => (p?.measurements ?? []).map((m) => Number(m.number))))
  );
}

export function measurementPhotoHeading(
  annotations: Pick<PhotoAnnotations, 'measurementDetails' | 'measurements'>,
) {
  const details = annotations.measurementDetails;
  const side = details?.side?.trim() ?? '';
  const points =
    details?.pointNumbers?.trim() ||
    annotations.measurements?.map((m) => m.number).join(', ') ||
    '';
  const useSide = details?.headerMode === 'points' ? !points && !!side : !!side;
  return { label: useSide ? 'LADO' : 'PONTOS', value: useSide ? side : points };
}

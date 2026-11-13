import type { PhotoAnnotations } from './photo-annotations';

/** Legacy point fields remain usable when opening a photo in the new editor. */
export function measurementPhotoDefaults(
  point?: { label?: string | null; data?: unknown },
  projectThickness?: unknown,
): NonNullable<PhotoAnnotations['measurementDetails']> {
  const data =
    point?.data && typeof point.data === 'object' && !Array.isArray(point.data)
      ? (point.data as Record<string, unknown>)
      : {};
  return {
    side: point?.label ?? '',
    discontinuity: String(data.discontinuity ?? ''),
    acceptable: typeof data.acceptable === 'boolean' ? data.acceptable : null,
    projectThickness: String(data.projectThickness ?? projectThickness ?? ''),
  };
}

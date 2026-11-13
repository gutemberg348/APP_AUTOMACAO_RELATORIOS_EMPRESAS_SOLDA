/** TH uses a gallery, including photos attached to points by earlier app versions. */
export function isHydrostaticTestPhoto(photo: {
  sectionKey?: string | null;
  clientUploadId?: string | null;
}) {
  return photo.sectionKey !== 'drawing' && !photo.clientUploadId?.startsWith('drawing-image-');
}

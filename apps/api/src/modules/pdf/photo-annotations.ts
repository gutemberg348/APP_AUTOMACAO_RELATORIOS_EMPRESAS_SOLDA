import sharp from 'sharp';
import { photoAnnotationsSchema, photoAnnotationsSvg } from '@weldcosta/shared';

export async function photoWithAnnotations(
  content: Buffer,
  mimeType: string,
  annotations: unknown,
) {
  if (!annotations) return 'data:' + mimeType + ';base64,' + content.toString('base64');
  const parsed = photoAnnotationsSchema.parse(annotations);
  if (!parsed.elements.length && !parsed.measurements?.length)
    return 'data:' + mimeType + ';base64,' + content.toString('base64');
  const info = await sharp(content).metadata();
  const sourceWidth = info.width ?? 1000,
    sourceHeight = info.height ?? 800;
  const scale = Math.min(1, 2000 / sourceWidth, 2000 / sourceHeight);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const svg = photoAnnotationsSvg(
    'data:' + mimeType + ';base64,' + content.toString('base64'),
    info.width ?? 1000,
    info.height ?? 800,
    {
      measurements: parsed.measurements,
      elements: parsed.elements.map((e) =>
        e.type === 'text' ? { ...e, text: e.text.toLocaleUpperCase('pt-BR') } : e,
      ),
    },
  ).replace('width="100%" height="100%"', `width="${width}" height="${height}"`);
  const painted = await sharp(Buffer.from(svg)).png().toBuffer();
  return 'data:image/png;base64,' + painted.toString('base64');
}

/** Bake the evidence frame into the exported copy, including portrait/legacy photos.
 * Keep drawing images separate: their crop and proportions belong to the CAD page. */
export async function photoForPdf(content: Buffer, mimeType: string, annotations: unknown) {
  const annotated = await photoWithAnnotations(content, mimeType, annotations);
  const bytes = Buffer.from(annotated.slice(annotated.indexOf(',') + 1), 'base64');
  const framed = await sharp(bytes, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize(1200, 900, { fit: 'fill' })
    .flatten({ background: '#FFFFFF' })
    .jpeg({ quality: 90 })
    .toBuffer();
  return 'data:image/jpeg;base64,' + framed.toString('base64');
}

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
  const width = Math.min(2000, info.width ?? 1600);
  const height = Math.round((width * (info.height ?? 800)) / (info.width ?? 1000));
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

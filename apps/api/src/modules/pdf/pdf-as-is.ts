import { randomUUID } from 'node:crypto';
import { z, ZodError } from 'zod';
import sharp from 'sharp';
import {
  pointInputSchema,
  lpWeldGroups,
  reportSignerSchema,
  reportNumberSchema,
  drawingDataSchema,
  drawingElementSchema,
  newDrawingData,
  photoAnnotationsSchema,
  validateSpecificData,
  signatureDrawingSchema,
  signatureStrokePath,
  reportReviewWarnings,
  reportSections,
  type CurrentUser,
} from '@weldcosta/shared';
import type { PdfReport } from './templates/reports/layout';
import { reportForPdf } from './pdf-snapshot';
import { photoForPdf, photoWithAnnotations } from './photo-annotations';
import { LocalStorageProvider } from '../../services/storage/local-storage-provider';
import { prisma } from '../../prisma/client';
import { signatureScope } from '../../middlewares/access-scope';
import { env } from '../../config/env';

const rawRecord = z.record(z.string(), z.unknown());
export const pdfAsIsSchema = z
  .object({
    values: z
      .object({
        number: z.unknown().optional(),
        title: z.unknown().optional(),
        reportDate: z.unknown().optional(),
        specificData: rawRecord.default({}),
        points: z.array(rawRecord).max(2000).default([]),
        signatures: z.array(rawRecord).max(50).default([]),
        drawings: z.array(rawRecord).max(12).default([]),
      })
      .strict(),
    photos: z
      .array(
        z
          .object({
            id: z.string().min(1).max(100),
            pointKey: z.string().max(100).nullable(),
            pointNumber: z.string().max(100).optional(),
            name: z.string().max(500),
            sectionKey: z.enum(['drawing', 'photos', 'test-photos']).default('photos'),
            caption: z.string().max(10000),
            annotations: z.unknown().optional(),
            fileIndex: z.number().int().min(0).max(99).nullable(),
          })
          .strict(),
      )
      .max(100)
      .default([]),
    removedIds: z.array(z.string().max(100)).max(2000).default([]),
    captionEdits: z.record(z.string(), z.string().max(10000)).default({}),
    annotationEdits: z.record(z.string(), z.unknown()).default({}),
    localSignatures: z
      .array(
        z
          .object({
            id: z.string().max(100),
            fileIndex: z.number().int().min(0).max(99).optional(),
            strokes: z.unknown().optional(),
          })
          .strict(),
      )
      .max(50)
      .default([]),
    warnings: z.array(z.string().max(1000)).max(200).default([]),
  })
  .strict();
export type PdfAsIsInput = z.infer<typeof pdfAsIsSchema>;

// A printable snapshot only. Never update the report or make a saved upload here.
export async function preparePdfAsIs(
  original: PdfReport,
  input: PdfAsIsInput,
  files: Buffer[],
  user: CurrentUser,
) {
  const storage = new LocalStorageProvider(env.STORAGE_PATH);
  const warnings = [...input.warnings];
  const warn = (message: string) => {
    if (!warnings.includes(message)) warnings.push(message);
  };
  const labels: Record<string, string> = {
    number: 'número',
    value: 'leitura',
    type: 'tipo',
    label: 'identificação',
    unit: 'unidade',
    data: 'dados',
    name: 'nome',
    signedAt: 'data',
    registrationNumber: 'registro',
    signatureAssetId: 'assinatura',
    role: 'função',
  };
  function fields(shape: Record<string, z.ZodType>, raw: Record<string, unknown>, label: string) {
    const result: Record<string, unknown> = {};
    for (const [key, schema] of Object.entries(shape)) {
      const parsed = schema.safeParse(
        raw[key] === '' && key !== 'name' && key !== 'number' ? undefined : raw[key],
      );
      if (parsed.success) result[key] = parsed.data;
      else {
        warn(
          `${label}: ${labels[key] ?? key} inválido. Esse campo ficará sem preenchimento no PDF; os outros dados serão incluídos.`,
        );
      }
    }
    return result;
  }
  const technicalFields =
    reportSections[original.reportType.code]?.flatMap((section) => section.fields) ?? [];
  const values = input.values;
  if (typeof values.title !== 'string')
    warn('Título inválido. O PDF usará o título salvo; confira em Identificação.');
  const parsedNumber = reportNumberSchema.safeParse(values.number);
  const number = parsedNumber.success ? parsedNumber.data : original.number;
  if (!parsedNumber.success)
    warn(
      `Número do relatório inválido no formulário. O PDF usará o número já salvo: ${original.number || 'não informado'}. Corrija em Identificação.`,
    );
  let reportDate = original.reportDate;
  if (!values.reportDate) reportDate = null;
  else {
    const date = z.iso.date().safeParse(values.reportDate);
    reportDate = date.success ? new Date(date.data) : null;
    if (!date.success)
      warn('Data do relatório inválida. A data ficará vazia no PDF; corrija em Identificação.');
  }
  const points = values.points.map((raw, index) => {
    const label = `Ponto ${typeof raw.number === 'string' && raw.number ? raw.number : index + 1}`;
    const fieldsOut = fields(pointInputSchema.shape, raw, label);
    // One invalid point field must not discard its other inspection values.
    const data =
      raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)
        ? (raw.data as Record<string, unknown>)
        : {};
    const printableData: Record<string, unknown> = {};
    for (const key of ['dimension', 'projectThickness', 'discontinuity', 'notes'])
      if (typeof data[key] === 'string') printableData[key] = data[key];
    if (typeof data.acceptable === 'boolean') printableData.acceptable = data.acceptable;
    return {
      ...fieldsOut,
      id: `export-point-${index}`,
      number: fieldsOut.number ?? String(index + 1),
      type: fieldsOut.type ?? 'CUSTOM',
      value: fieldsOut.value ?? null,
      data: printableData,
    };
  }) as unknown as PdfReport['points'];
  const pointIds = new Map<string, string>();
  values.points.forEach((point, index) => {
    const key = point.id ?? point.clientId;
    if (typeof key === 'string') pointIds.set(key, points[index]!.id);
  });
  const byNumber = (number?: string) => {
    const matches = points.filter((p) => p.number === number);
    return matches.length === 1 ? matches[0]!.id : undefined;
  };
  // Accept incomplete technical fields. Remove only invalid fields before rendering.
  let specificData = structuredClone(values.specificData);
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      specificData = validateSpecificData(
        original.reportType.code,
        specificData,
        'draft',
        original.reportType.config,
      );
      break;
    } catch (cause) {
      if (!(cause instanceof ZodError)) throw cause;
      let changed = false;
      for (const issue of cause.issues) {
        const path = issue.path.map(String);
        if (issue.code === 'unrecognized_keys' && 'keys' in issue) {
          for (const key of issue.keys) {
            delete specificData[key];
            changed = true;
          }
          continue;
        }
        let target: Record<string, unknown> | undefined = specificData;
        for (const key of path.slice(0, -1)) {
          const next: unknown = target?.[key];
          target = next && typeof next === 'object' ? (next as Record<string, unknown>) : undefined;
        }
        const last = path.at(-1);
        if (target && last && last in target) {
          delete target[last];
          changed = true;
        }
        const fieldLabel =
          technicalFields.find((field) => field.path === path.join('.'))?.label ?? path.join(' / ');
        warn(
          `Dados do ensaio · ${fieldLabel}: ${issue.message} Esse campo não pôde ser incluído; confira no formulário.`,
        );
      }
      if (!changed) break;
    }
  }
  const images = new Map<string, string>();
  const media: PdfReport['media'] = [];
  const annotations = (raw: unknown, label: string) => {
    if (!raw) return null;
    const parsed = photoAnnotationsSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
    warn(
      `${label}: há marcações inválidas. A foto será incluída sem essas marcações; confira em Fotos.`,
    );
    return null;
  };
  async function addPhoto(item: PdfReport['media'][number], bytes: Buffer, label: string) {
    try {
      const info = await sharp(bytes, { limitInputPixels: false }).metadata();
      if (
        !['jpeg', 'png', 'webp'].includes(info.format ?? '') ||
        (info.width ?? 0) * (info.height ?? 0) > 128000000
      )
        throw new Error('Invalid image');
      const normalized = await sharp(bytes, { limitInputPixels: 128000000 })
        .rotate()
        .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
        .flatten({ background: '#fff' })
        .jpeg({ quality: 88 })
        .toBuffer();
      images.set(
        item.id,
        await (item.sectionKey === 'drawing' ? photoWithAnnotations : photoForPdf)(
          normalized,
          'image/jpeg',
          item.annotations,
        ),
      );
      media.push(item);
    } catch {
      warn(
        `${label}: não foi possível ler o arquivo. Somente esta foto ficará fora do PDF; selecione-a novamente em Fotos.`,
      );
    }
  }
  const pendingKeys = new Set(input.photos.map((p) => p.id));
  for (const saved of original.media) {
    if (
      input.removedIds.includes(saved.id) ||
      (saved.clientUploadId && pendingKeys.has(saved.clientUploadId))
    )
      continue;
    const oldPoint = original.points.find((p) => p.id === saved.reportPointId);
    const pointId = saved.reportPointId ? pointIds.get(saved.reportPointId) : null;
    const label = `${oldPoint ? 'Ponto ' + oldPoint.number + ' · ' : ''}Foto “${saved.originalName}”`;
    if (saved.reportPointId && !pointId)
      warn(
        `${label}: o ponto não está mais no formulário. A foto será incluída nas imagens complementares.`,
      );
    const item = {
      ...saved,
      reportPointId: pointId ?? null,
      caption: input.captionEdits[saved.id] ?? saved.caption,
      annotations: annotations(
        input.annotationEdits[saved.id] === undefined
          ? saved.annotations
          : input.annotationEdits[saved.id],
        label,
      ),
    } as PdfReport['media'][number];
    try {
      await addPhoto(item, await storage.get(saved.filePath), label);
    } catch {
      warn(
        `${label}: arquivo indisponível no servidor. Somente essa foto ficará fora do PDF; envie-a novamente.`,
      );
    }
  }
  for (const photo of input.photos) {
    const pointId = photo.pointKey
      ? (pointIds.get(photo.pointKey) ?? byNumber(photo.pointNumber))
      : null;
    const label = `${photo.pointNumber ? 'Ponto ' + photo.pointNumber + ' · ' : ''}Foto “${photo.name}”`;
    if (photo.pointKey && !pointId)
      warn(
        `${label}: está sem vínculo com um ponto. A foto será incluída nas imagens complementares. Corrija em Pontos e fotos → Fotos aguardando vínculo.`,
      );
    const bytes = photo.fileIndex == null ? undefined : files[photo.fileIndex];
    if (!bytes) {
      warn(
        `${label}: arquivo não disponível no telefone. Somente essa foto ficará fora do PDF; selecione-a novamente.`,
      );
      continue;
    }
    await addPhoto(
      {
        id: 'export-photo-' + photo.id,
        clientUploadId: photo.id,
        originalName: photo.name,
        sectionKey: photo.sectionKey,
        reportPointId: pointId ?? null,
        caption: photo.caption,
        annotations: annotations(photo.annotations, label),
        filePath: '',
        mimeType: 'image/jpeg',
      } as PdfReport['media'][number],
      bytes,
      label,
    );
  }
  const availableImages = new Set(
    media.filter((m) => m.sectionKey === 'drawing').map((m) => m.clientUploadId ?? m.id),
  );
  const drawings = values.drawings.map((raw, index) => {
    const rawData =
      raw.data && typeof raw.data === 'object' ? (raw.data as Record<string, unknown>) : {};
    const title = `Desenho ${index + 1}`;
    const header = { ...rawData };
    const sourceElements = header.elements;
    delete header.notes;
    delete header.notesDrawing;
    delete header.elements;
    const base = drawingDataSchema.safeParse({ ...header, elements: [] });
    const data = base.success ? base.data : newDrawingData();
    const ids = new Set<string>(),
      marked = new Set<string>();
    for (const [i, element] of (Array.isArray(sourceElements) ? sourceElements : []).entries()) {
      const parsed = drawingElementSchema.safeParse(element);
      if (!parsed.success) {
        warn(
          `${title} · elemento ${i + 1}: formato inválido. Somente esse elemento ficará fora do PDF.`,
        );
        continue;
      }
      let next = parsed.data;
      if (next.type === 'image' && !availableImages.has(next.mediaKey)) {
        warn(
          `${title} · imagem ${i + 1}: arquivo indisponível. Essa imagem ficará fora do PDF; os demais elementos serão incluídos.`,
        );
        continue;
      }
      if (next.type === 'point') {
        const id = pointIds.get(next.reportPointId);
        if (!id || marked.has(id)) {
          warn(
            `${title} · marcação ${i + 1}: ponto sem vínculo ou repetido. Somente essa marcação ficará fora do PDF.`,
          );
          continue;
        }
        marked.add(id);
        next = { ...next, reportPointId: id };
      }
      if (ids.has(next.id)) next = { ...next, id: randomUUID() };
      const candidate = drawingDataSchema.safeParse({ ...data, elements: [next] });
      if (candidate.success) {
        data.elements.push(next);
        ids.add(next.id);
      } else
        warn(
          `${title} · elemento ${i + 1}: geometria inválida. Somente esse elemento ficará fora do PDF.`,
        );
    }
    return { id: 'export-drawing-' + index, data };
  }) as unknown as PdfReport['drawings'];
  const signatureImages: Record<string, string> = {};
  const signatures = [] as PdfReport['signatures'];
  for (const [index, raw] of values.signatures.entries()) {
    const parsed = fields(reportSignerSchema.shape, raw, `Responsável ${index + 1}`);
    const id = 'export-signature-' + index;
    let bytes: Buffer | undefined;
    if (parsed.role !== 'CLIENT' && parsed.signatureAssetId) {
      const local = input.localSignatures.find((s) => s.id === raw.signatureAssetId);
      try {
        if (local?.strokes) {
          const { strokes } = signatureDrawingSchema.parse({ strokes: local.strokes });
          bytes = await sharp(
            Buffer.from(
              `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="500"><g fill="none" stroke="#14243a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${strokes.map((s) => `<path d="${signatureStrokePath(s)}"/>`).join('')}</g></svg>`,
            ),
          )
            .png()
            .toBuffer();
        } else if (local?.fileIndex !== undefined) bytes = files[local.fileIndex];
        else {
          const asset = await prisma.signatureAsset.findFirst({
            where: { id: String(parsed.signatureAssetId), ...signatureScope(user) },
          });
          if (asset) bytes = await storage.get(asset.filePath);
        }
        if (bytes)
          signatureImages[id] =
            'data:image/png;base64,' +
            (
              await sharp(bytes, { limitInputPixels: 40000000 })
                .resize({ width: 1000, height: 500, fit: 'inside', withoutEnlargement: true })
                .png()
                .toBuffer()
            ).toString('base64');
        else throw new Error('Signature unavailable');
      } catch {
        warn(
          `Responsável ${index + 1} · ${String(parsed.name ?? '')}: assinatura indisponível. O nome será incluído e a linha de assinatura ficará vazia.`,
        );
      }
    }
    signatures.push({
      ...parsed,
      id,
      role: parsed.role ?? 'OTHER',
      name: parsed.name ?? '',
      signedAt: parsed.signedAt ? new Date(String(parsed.signedAt)) : null,
    } as PdfReport['signatures'][number]);
  }
  const report = reportForPdf({
    ...original,
    number,
    title: typeof values.title === 'string' ? values.title.slice(0, 10000) : original.title,
    reportDate,
    specificData,
    points,
    media,
    drawings,
    signatures,
    signatureImages,
  } as PdfReport);
  const printableGroups =
    report.reportType.code === 'LP'
      ? lpWeldGroups(report.points)
      : report.points.map((point, index) => ({
          index,
          number: point.number,
          memberIndexes: [index],
        }));
  for (const group of printableGroups) {
    const point = { ...report.points[group.index]!, number: group.number };
    const data = point.data as Record<string, unknown> | null;
    if (!point.number.trim())
      warn(
        'Há um ponto sem número. Seus dados e fotos serão incluídos, mas o número ficará vazio. Corrija em Pontos e fotos → Número.',
      );
    if (typeof data?.acceptable !== 'boolean')
      warn(
        `Ponto ${point.number}: resultado não informado. O ponto e suas fotos serão incluídos; o resultado ficará sem preenchimento. Corrija em Pontos e fotos → Aceitável.`,
      );
    if (point.type === 'MEASUREMENT' && point.value == null)
      warn(
        `Ponto ${point.number}: leitura de espessura não informada ou inválida. As fotos serão incluídas; a leitura ficará vazia. Corrija em Pontos e fotos → Leitura.`,
      );
    if (
      !report.media.some((m) =>
        group.memberIndexes.some((index) => m.reportPointId === report.points[index]!.id),
      )
    )
      warn(
        `Ponto ${point.number}: sem foto disponível. Os dados do ponto serão incluídos sem imagem.`,
      );
  }
  for (const warning of reportReviewWarnings({
    ...report,
    points: report.points.map((p) => ({ ...p, value: p.value == null ? null : Number(p.value) })),
  }))
    warn(warning);
  return { report, images, warnings };
}

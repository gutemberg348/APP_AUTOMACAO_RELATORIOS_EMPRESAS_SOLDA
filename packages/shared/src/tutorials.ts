import { z } from 'zod';

export const tutorialMetadataSchema = z.object({
  title: z.string().trim().min(1, 'Informe o título do tutorial.').max(180),
  description: z.string().trim().max(6000).default(''),
});
export type Tutorial = {
  id: string;
  title: string;
  description: string | null;
  content: string;
  originalName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};
export const tutorialKind = (mime?: string | null) =>
  mime?.startsWith('image/') ? 'image' : mime?.startsWith('video/') ? 'video' : 'document';
export const tutorialFileTypes = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
} as const;
export const tutorialMaxBytes = (mime: string) =>
  (tutorialKind(mime) === 'video' ? 100 : tutorialKind(mime) === 'image' ? 10 : 20) * 1024 * 1024;

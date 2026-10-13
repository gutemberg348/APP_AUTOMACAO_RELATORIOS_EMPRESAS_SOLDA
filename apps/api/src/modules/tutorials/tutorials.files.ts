import { open } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { tutorialFileTypes, tutorialMaxBytes } from '@weldcosta/shared';
import { AppError } from '../../errors/app-error';

export async function validateTutorialFile(file: Express.Multer.File) {
  const extension = path.extname(file.originalname).slice(1).toLowerCase();
  const mimeType = tutorialFileTypes[extension as keyof typeof tutorialFileTypes];
  const invalid = () =>
    new AppError(
      400,
      'INVALID_FILE',
      'Use uma foto JPG, PNG ou WebP, documento PDF/Office ou vídeo MP4, MOV ou WebM válido.',
    );
  if (!mimeType) throw invalid();
  if (file.size > tutorialMaxBytes(mimeType))
    throw new AppError(
      400,
      'FILE_TOO_LARGE',
      'Limite por arquivo: fotos 10 MB, documentos 20 MB e vídeos 100 MB.',
    );
  const handle = await open(file.path, 'r');
  const header = Buffer.alloc(32);
  try {
    await handle.read(header, 0, header.length, 0);
  } finally {
    await handle.close();
  }
  if (mimeType.startsWith('image/')) {
    try {
      const metadata = await sharp(file.path, { limitInputPixels: 40_000_000 }).metadata();
      const expected = extension === 'jpg' ? 'jpeg' : extension;
      if (metadata.format !== expected || !metadata.width || !metadata.height) throw invalid();
    } catch {
      throw invalid();
    }
  } else {
    const valid =
      extension === 'pdf'
        ? header.subarray(0, 5).toString() === '%PDF-'
        : ['mp4', 'mov'].includes(extension)
          ? header.subarray(4, 8).toString() === 'ftyp'
          : extension === 'webm'
            ? header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
            : header.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    if (!valid) throw invalid();
  }
  return {
    mimeType,
    originalName: path
      .basename(file.originalname.replace(/\\/g, '/'))
      .split('')
      .filter((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)
      .join('')
      .slice(0, 200),
    fileSize: file.size,
  };
}
